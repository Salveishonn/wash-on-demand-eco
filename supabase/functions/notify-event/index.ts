import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  // Only allow internal callers (other edge functions using the service role key)
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

    // Always log the event to webhook_events table
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

    // === CREATE OPERATOR NOTIFICATION ===
    const notifMap: Record<string, { title: string; body: string }> = {
      "booking.created": {
        title: "Nueva reserva",
        body: `${payload.customer_name || 'Cliente'} — ${payload.metadata?.service_name || 'Lavado'} — ${payload.metadata?.booking_date || ''} ${payload.metadata?.booking_time || ''}`,
      },
      "booking.cancelled": {
        title: "Reserva cancelada",
        body: `${payload.customer_name || 'Cliente'} canceló su reserva`,
      },
      "booking.rescheduled": {
        title: "Reserva reprogramada",
        body: `${payload.customer_name || 'Cliente'} reprogramó su lavado`,
      },
      "booking.paid": {
        title: "Pago recibido",
        body: `${payload.customer_name || 'Cliente'} — $${payload.amount_ars?.toLocaleString('es-AR') || '0'}`,
      },
      "subscription.created": {
        title: "Nueva suscripción",
        body: `${payload.customer_name || 'Cliente'} se suscribió`,
      },
      "subscription.approved": {
        title: "Suscripción aprobada",
        body: `Suscripción de ${payload.customer_name || 'Cliente'} aprobada`,
      },
    };

    const notifData = notifMap[payload.event];
    if (notifData) {
      const { error: notifError } = await supabase
        .from("operator_notifications")
        .insert({
          event_type: payload.event.replace('.', '_'),
          title: notifData.title,
          body: notifData.body,
          data: payload as any,
          user_id: null, // broadcast to all operators
          read: false,
        });
      if (notifError) {
        console.error("[notify-event] Failed to create operator notification:", notifError);
      } else {
        console.log("[notify-event] Operator notification created for:", payload.event);
      }
    }

    // === TRIGGER WHATSAPP NOTIFICATIONS FOR KEY EVENTS ===
    // Queue WhatsApp template messages for subscription.approved
    if (payload.event === "subscription.approved" && payload.customer_phone) {
      console.log("[notify-event] Queueing WhatsApp for subscription.approved");
      
      // Template: washero_subscription_active - 3 params: {1} = name, {2} = plan name, {3} = washes count
      const customerName = payload.customer_name?.split(" ")[0] || "Cliente";
      const planName = (payload.metadata?.plan_name as string) || "Tu plan";
      const washesCount = (payload.metadata?.washes_per_month as string) || "tus lavados";
      
      await supabase.from("whatsapp_outbox").insert({
        entity_type: "subscription",
        entity_id: payload.subscription_id,
        to_phone_e164: payload.customer_phone,
        template_name: "washero_subscription_active",
        language_code: "es_AR",
        template_vars: [customerName, planName, String(washesCount)],
        status: "queued",
      });
      
      console.log("[notify-event] WhatsApp queued for subscription activation");
    }

    // If N8N_WEBHOOK_URL is not configured, just return success
    if (!n8nWebhookUrl) {
      console.log("[notify-event] N8N_WEBHOOK_URL not configured, skipping external dispatch");
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: "Event logged, no external webhook configured",
          event_id: eventRecord?.id 
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Attempt to deliver to external webhook
    let delivered = false;
    let errorMessage: string | null = null;

    try {
      const response = await fetch(n8nWebhookUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        delivered = true;
        console.log("[notify-event] Successfully delivered to n8n");
      } else {
        errorMessage = `HTTP ${response.status}: ${await response.text()}`;
        console.error("[notify-event] Webhook delivery failed:", errorMessage);
      }
    } catch (fetchError: any) {
      errorMessage = fetchError.message || "Network error";
      console.error("[notify-event] Webhook fetch error:", errorMessage);
    }

    // Update the event record with delivery status
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
      JSON.stringify({ 
        success: true, 
        delivered,
        event_id: eventRecord?.id,
        error: errorMessage 
      }),
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
