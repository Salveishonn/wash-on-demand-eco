import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { queueTemplateSend, triggerOutboxProcessing } from "../_whatsappAutomation/queueTemplateSend.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface WebhookEventPayload {
  event: string;
  timestamp: string;
  user_id?: string;
  customer_email?: string;
  customer_phone?: string;
  customer_name?: string;
  booking_id?: string;
  subscription_id?: string;
  invoice_id?: string;
  amount_ars?: number;
  status?: string;
  metadata?: Record<string, unknown>;
}

// ── Spanish day name helper ────────────────────────────────
function formatDayName(dateStr: string): string {
  try {
    const [y, m, d] = dateStr.split("-").map(Number);
    const date = new Date(y, m - 1, d);
    const days = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
    return days[date.getDay()];
  } catch {
    return dateStr;
  }
}

// ── Build smart notification content ──────────────────────
interface SmartNotif {
  title: string;
  body: string;
  tag: string;
  url: string;
  requireInteraction: boolean;
}

function buildSmartNotification(event: string, payload: WebhookEventPayload): SmartNotif | null {
  const meta = payload.metadata || {};
  const day = meta.booking_date ? formatDayName(meta.booking_date as string) : "";
  const time = (meta.booking_time as string) || "";
  const barrio = (meta.barrio as string) || (meta.address as string)?.split(",")[0] || "";
  const service = (meta.service_name as string) || "Lavado";
  const name = payload.customer_name || "Cliente";

  switch (event) {
    case "booking.created":
      return {
        title: "🚗 Nuevo lavado",
        body: `${day} ${time} · ${barrio}\n${service}`.trim(),
        tag: "booking-new",
        url: "/ops/agenda",
        requireInteraction: true,
      };

    case "booking.cancelled":
      return {
        title: "❌ Lavado cancelado",
        body: `${day} ${time} · ${barrio}`.trim(),
        tag: "booking-cancelled",
        url: "/ops/agenda",
        requireInteraction: false,
      };

    case "booking.rescheduled":
      return {
        title: "🔁 Lavado reprogramado",
        body: `Nuevo horario: ${day} ${time}`.trim(),
        tag: "booking-rescheduled",
        url: "/ops/agenda",
        requireInteraction: false,
      };

    case "booking.paid":
      return {
        title: "💳 Pago recibido",
        body: `${name} — $${payload.amount_ars?.toLocaleString("es-AR") || "0"}`,
        tag: "booking-paid",
        url: "/ops/agenda",
        requireInteraction: false,
      };

    case "subscription.created":
      return {
        title: "⭐ Nueva suscripción",
        body: `${name} se suscribió`,
        tag: "subscription-new",
        url: "/ops/agenda",
        requireInteraction: true,
      };

    case "subscription.approved":
      return {
        title: "✅ Suscripción aprobada",
        body: `Suscripción de ${name} aprobada`,
        tag: "subscription-approved",
        url: "/ops/agenda",
        requireInteraction: false,
      };

    default:
      return null;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const authHeader = req.headers.get("Authorization");
  if (!authHeader || authHeader !== `Bearer ${supabaseServiceKey}`) {
    return new Response(
      JSON.stringify({ error: "Unauthorized" }),
      { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const n8nWebhookUrl = Deno.env.get("N8N_WEBHOOK_URL");
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const payload: WebhookEventPayload = await req.json();
    console.log("[notify-event] Received event:", payload.event);

    // Log to webhook_events table
    const { data: eventRecord, error: insertError } = await supabase
      .from("webhook_events")
      .insert({
        event_type: payload.event,
        payload: payload,
        delivered: false,
        attempts: 0,
      })
      .select()
      .single();

    if (insertError) {
      console.error("[notify-event] Failed to log event:", insertError);
    }

    // === BUILD SMART NOTIFICATION ===
    const notif = buildSmartNotification(payload.event, payload);

    if (notif) {
      // Insert operator notification
      const { error: notifError } = await supabase
        .from("operator_notifications")
        .insert({
          event_type: payload.event.replace(".", "_"),
          title: notif.title,
          body: notif.body,
          data: payload as any,
          user_id: null,
          read: false,
        });

      if (notifError) {
        console.error("[notify-event] Failed to create operator notification:", notifError);
      }

      // === TRIGGER PUSH ===
      try {
        const pushResponse = await fetch(`${supabaseUrl}/functions/v1/send-ops-notification`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${supabaseServiceKey}`,
          },
          body: JSON.stringify({
            event_type: payload.event.replace(".", "_"),
            title: notif.title,
            body: notif.body,
            tag: notif.tag,
            url: notif.url,
            requireInteraction: notif.requireInteraction,
            data: {
              ...payload,
              url: notif.url,
              tag: notif.tag,
              booking_id: payload.booking_id,
            },
          }),
        });
        const pushResult = await pushResponse.json();
        console.log("[notify-event] Push result:", JSON.stringify(pushResult));
      } catch (pushErr: any) {
        console.error("[notify-event] Push error:", pushErr.message);
      }
    }

    // ============================================================
    // WHATSAPP TEMPLATE AUTOMATIONS
    // Queue template messages for relevant events via centralized layer
    // ============================================================
    const meta = payload.metadata || {};

    if (payload.event === "booking.created" && payload.customer_phone) {
      const result = await queueTemplateSend(
        supabase,
        'booking_created',
        {
          customerName: payload.customer_name || 'Cliente',
          customerPhone: payload.customer_phone,
          bookingDate: (meta.booking_date as string) || undefined,
          bookingTime: (meta.booking_time as string) || undefined,
          address: (meta.address as string) || undefined,
          serviceName: (meta.service_name as string) || undefined,
          bookingId: payload.booking_id,
        },
        'reservation',
        payload.booking_id,
      );
      console.log("[notify-event] Template queue result (booking_created):", result);
      triggerOutboxProcessing(supabaseUrl, supabaseServiceKey);
    }

    if (payload.event === "booking.payment_required" && payload.customer_phone) {
      const result = await queueTemplateSend(
        supabase,
        'payment_instructions',
        {
          customerName: payload.customer_name || 'Cliente',
          customerPhone: payload.customer_phone,
          paymentUrl: (meta.payment_url as string) || undefined,
          bookingId: payload.booking_id,
        },
        'reservation',
        payload.booking_id,
      );
      console.log("[notify-event] Template queue result (payment_instructions):", result);
      triggerOutboxProcessing(supabaseUrl, supabaseServiceKey);
    }

    if (payload.event === "subscription.approved" && payload.customer_phone) {
      const result = await queueTemplateSend(
        supabase,
        'subscription_approved',
        {
          customerName: payload.customer_name || 'Cliente',
          customerPhone: payload.customer_phone,
          planName: (meta.plan_name as string) || undefined,
          washesPerMonth: meta.washes_per_month as number || undefined,
          subscriptionId: payload.subscription_id,
        },
        'subscription',
        payload.subscription_id,
      );
      console.log("[notify-event] Template queue result (subscription_approved):", result);
      triggerOutboxProcessing(supabaseUrl, supabaseServiceKey);
    }

    // === EXTERNAL WEBHOOK (n8n) ===
    if (!n8nWebhookUrl) {
      return new Response(
        JSON.stringify({ success: true, message: "Event logged", event_id: eventRecord?.id }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let delivered = false;
    let errorMessage: string | null = null;

    try {
      const response = await fetch(n8nWebhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (response.ok) {
        delivered = true;
      } else {
        errorMessage = `HTTP ${response.status}: ${await response.text()}`;
      }
    } catch (fetchError: any) {
      errorMessage = fetchError.message || "Network error";
    }

    if (eventRecord?.id) {
      await supabase
        .from("webhook_events")
        .update({
          delivered,
          delivered_at: delivered ? new Date().toISOString() : null,
          error: errorMessage,
          attempts: 1,
        })
        .eq("id", eventRecord.id);
    }

    return new Response(
      JSON.stringify({ success: true, delivered, event_id: eventRecord?.id, error: errorMessage }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("[notify-event] Error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
