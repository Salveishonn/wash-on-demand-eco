import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BACKOFF_MULTIPLIER = 2;
const BASE_DELAY_SECONDS = 60;

// Admin WhatsApp number for sandbox validation
const ADMIN_WHATSAPP = "+5491130951804";

const formatPrice = (cents: number) => {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 0,
  }).format(cents / 100);
};

const formatDate = (date: string) => {
  return new Date(date).toLocaleDateString("es-AR", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
};

async function sendEmail(
  resendApiKey: string,
  to: string,
  subject: string,
  html: string,
): Promise<{ success: boolean; id?: string; error?: string }> {
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Washero <reservas@washero.online>",
        to: [to],
        subject,
        html,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return { success: false, error: data.message || "Email send failed" };
    }

    return { success: true, id: data.id };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

// Normalize phone number to E.164 format
function normalizePhoneNumber(phone: string): string {
  // Remove all non-digit characters except leading +
  let cleaned = phone.replace(/[^\d+]/g, "");
  // Ensure it starts with +
  if (!cleaned.startsWith("+")) {
    cleaned = "+" + cleaned;
  }
  return cleaned;
}

// Format number for WhatsApp (add whatsapp: prefix if not present)
function formatWhatsAppNumber(phone: string): string {
  const normalized = normalizePhoneNumber(phone);
  // If already has whatsapp: prefix, return as-is
  if (phone.toLowerCase().startsWith("whatsapp:")) {
    return phone;
  }
  return `whatsapp:${normalized}`;
}

async function sendWhatsApp(
  accountSid: string,
  authToken: string,
  fromNumber: string,
  to: string,
  body: string,
): Promise<{
  success: boolean;
  sid?: string;
  status?: string;
  error?: string;
  errorCode?: number;
  from?: string;
  to?: string;
}> {
  try {
    const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
    const auth = btoa(`${accountSid}:${authToken}`);

    // Format From and To correctly for WhatsApp
    const formattedFrom = formatWhatsAppNumber(fromNumber);
    const formattedTo = formatWhatsAppNumber(to);

    console.log(`[sendWhatsApp] Sending from: ${formattedFrom} to: ${formattedTo}`);

    const response = await fetch(twilioUrl, {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        From: formattedFrom,
        To: formattedTo,
        Body: body,
      }),
    });

    const data = await response.json();

    console.log(`[sendWhatsApp] Twilio response:`, JSON.stringify(data));

    if (!response.ok) {
      return {
        success: false,
        error: data.message || JSON.stringify(data),
        errorCode: data.code,
        from: formattedFrom,
        to: formattedTo,
      };
    }

    return {
      success: true,
      sid: data.sid,
      status: data.status,
      from: formattedFrom,
      to: formattedTo,
    };
  } catch (err: any) {
    console.error(`[sendWhatsApp] Exception:`, err);
    return { success: false, error: err.message };
  }
}

function buildEmailHtml(booking: any, isCustomer: boolean = false): string {
  const totalPrice = booking.service_price_cents + (booking.car_type_extra_cents || 0);

  const title = isCustomer ? "¡Tu Reserva está Confirmada!" : "🚗 Nueva Reserva Washero";

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #1a1a1a; color: #FFD700; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
    .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
    .section { margin-bottom: 20px; }
    .section h3 { color: #1a1a1a; margin-bottom: 10px; border-bottom: 2px solid #FFD700; padding-bottom: 5px; }
    .detail-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #eee; }
    .price { font-size: 24px; color: #FFD700; font-weight: bold; }
    .status-badge { display: inline-block; padding: 5px 15px; border-radius: 20px; font-size: 12px; font-weight: 600; background: #10B981; color: white; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>${title}</h1>
      <p>ID: ${booking.id.substring(0, 8).toUpperCase()}</p>
    </div>
    <div class="content">
      <div class="section">
        <h3>📋 Servicio</h3>
        <div class="detail-row"><span>Servicio</span><span>${booking.service_name}</span></div>
        <div class="detail-row"><span>Vehículo</span><span>${booking.car_type || "No especificado"}</span></div>
        <div class="detail-row"><span>Total</span><span class="price">${formatPrice(totalPrice)}</span></div>
      </div>
      ${
        !isCustomer
          ? `
      <div class="section">
        <h3>👤 Cliente</h3>
        <div class="detail-row"><span>Nombre</span><span>${booking.customer_name}</span></div>
        <div class="detail-row"><span>Email</span><span>${booking.customer_email}</span></div>
        <div class="detail-row"><span>Teléfono</span><span>${booking.customer_phone}</span></div>
      </div>`
          : ""
      }
      <div class="section">
        <h3>📅 Fecha y Hora</h3>
        <div class="detail-row"><span>Fecha</span><span>${formatDate(booking.booking_date)}</span></div>
        <div class="detail-row"><span>Horario</span><span>${booking.booking_time} hs</span></div>
      </div>
      <div class="section">
        <h3>📍 Ubicación</h3>
        <p>${booking.address || "No especificada"}</p>
      </div>
      ${booking.notes ? `<div class="section"><h3>📝 Notas</h3><p>${booking.notes}</p></div>` : ""}
      <div class="section">
        <h3>💳 Estado</h3>
        <span class="status-badge">${booking.payment_status === "approved" ? "✅ Pagado" : booking.is_subscription_booking ? "🔄 Suscripción" : "⏳ Pendiente"}</span>
      </div>
      ${isCustomer ? '<p style="margin-top: 20px; text-align: center; color: #666;">¡Gracias por elegirnos! Te esperamos.</p>' : ""}
    </div>
  </div>
</body>
</html>`;
}

function buildWhatsAppMessage(booking: any, isCustomer: boolean = false): string {
  const totalPrice = booking.service_price_cents + (booking.car_type_extra_cents || 0);

  if (isCustomer) {
    return `✅ *RESERVA CONFIRMADA - WASHERO*

Hola ${booking.customer_name}! Tu reserva está lista.

📋 *Servicio:* ${booking.service_name}
🚗 *Vehículo:* ${booking.car_type || "No especificado"}
💰 *Total:* ${formatPrice(totalPrice)}

📅 ${formatDate(booking.booking_date)} - ${booking.booking_time}hs
📍 ${booking.address || "Sin dirección"}

ID: ${booking.id.substring(0, 8).toUpperCase()}

¡Gracias por elegirnos! 🚗✨`;
  }

  return `🚗 *NUEVA RESERVA WASHERO*

📋 *Detalles*
• ID: ${booking.id.substring(0, 8).toUpperCase()}
• Servicio: ${booking.service_name}
• Vehículo: ${booking.car_type || "No especificado"}
• Total: ${formatPrice(totalPrice)}

👤 *Cliente*
• ${booking.customer_name}
• ${booking.customer_phone}
• ${booking.customer_email}

📅 ${formatDate(booking.booking_date)} - ${booking.booking_time}hs
📍 ${booking.address || "Sin dirección"}

💳 ${booking.payment_status === "approved" ? "✅ Pagado" : "⏳ Pendiente"}`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const resendApiKey = Deno.env.get("RESEND_API_KEY");
  const twilioAccountSid = Deno.env.get("TWILIO_ACCOUNT_SID");
  const twilioAuthToken = Deno.env.get("TWILIO_AUTH_TOKEN");
  const twilioWhatsAppNumber = Deno.env.get("TWILIO_WHATSAPP_NUMBER");
  const whatsappMode = Deno.env.get("WHATSAPP_MODE") || "sandbox";

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    console.log("[process-notifications] Starting notification processing");
    console.log(`[process-notifications] WhatsApp mode: ${whatsappMode}`);

    // Get pending notifications (limit batch size)
    const { data: pendingNotifications, error: fetchError } = await supabase
      .from("notification_queue")
      .select("*")
      .in("status", ["pending", "failed"])
      .lte("next_retry_at", new Date().toISOString())
      .lt("attempts", 3)
      .order("created_at", { ascending: true })
      .limit(10);

    if (fetchError) {
      console.error("[process-notifications] Fetch error:", fetchError);
      throw fetchError;
    }

    if (!pendingNotifications || pendingNotifications.length === 0) {
      console.log("[process-notifications] No pending notifications");
      return new Response(JSON.stringify({ success: true, processed: 0 }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[process-notifications] Processing ${pendingNotifications.length} notifications`);

    let processed = 0;
    let succeeded = 0;
    let failed = 0;

    // Rate limiting: add delay between notifications to avoid Resend 2 rps limit
    const DELAY_BETWEEN_SENDS_MS = 600; // 600ms = ~1.6 rps, safe for 2 rps limit

    for (let i = 0; i < pendingNotifications.length; i++) {
      const notification = pendingNotifications[i];

      // Rate limiting delay (skip for first notification)
      if (i > 0 && notification.notification_type === "email") {
        await new Promise((resolve) => setTimeout(resolve, DELAY_BETWEEN_SENDS_MS));
      }
      // Mark as processing
      await supabase.from("notification_queue").update({ status: "processing" }).eq("id", notification.id);

      // Fetch booking details
      const { data: booking, error: bookingError } = await supabase
        .from("bookings")
        .select("*")
        .eq("id", notification.booking_id)
        .maybeSingle();

      if (bookingError || !booking) {
        console.error(`[process-notifications] Booking not found for ${notification.id}`);
        await supabase
          .from("notification_queue")
          .update({
            status: "exhausted",
            last_error: "Booking not found",
          })
          .eq("id", notification.id);
        continue;
      }

      // Determine if this is a customer or admin notification
      const isCustomerNotification =
        notification.recipient !== "washerocarwash@gmail.com" && notification.recipient !== ADMIN_WHATSAPP;

      let result: { success: boolean; id?: string; sid?: string; error?: string };

      if (notification.notification_type === "email") {
        if (!resendApiKey) {
          result = { success: false, error: "RESEND_API_KEY not configured" };
        } else {
          const html = buildEmailHtml(booking, isCustomerNotification);
          const subject = isCustomerNotification
            ? `✅ Reserva Confirmada - ${formatDate(booking.booking_date)}`
            : `🚗 Nueva Reserva: ${booking.customer_name} - ${formatDate(booking.booking_date)}`;

          result = await sendEmail(resendApiKey, notification.recipient, subject, html);
        }
      } else if (notification.notification_type === "whatsapp") {
        if (!twilioAccountSid || !twilioAuthToken || !twilioWhatsAppNumber) {
          result = { success: false, error: "Twilio credentials not configured" };
        } else {
          // In sandbox mode, only send to admin number
          if (whatsappMode === "sandbox" && isCustomerNotification) {
            result = {
              success: false,
              error: "WhatsApp in sandbox mode - customer messages not sent. Customer will receive email confirmation.",
            };
            console.log(
              `[process-notifications] Skipping customer WhatsApp in sandbox mode for ${notification.recipient}`,
            );
          } else {
            const message = buildWhatsAppMessage(booking, isCustomerNotification);
            result = await sendWhatsApp(
              twilioAccountSid,
              twilioAuthToken,
              twilioWhatsAppNumber,
              notification.recipient,
              message,
            );
          }
        }
      } else {
        result = { success: false, error: "Unknown notification type" };
      }

      const newAttempts = notification.attempts + 1;

      if (result.success) {
        // Success
        await supabase
          .from("notification_queue")
          .update({
            status: "sent",
            attempts: newAttempts,
            external_id: result.id || result.sid,
            sent_at: new Date().toISOString(),
            last_error: null,
          })
          .eq("id", notification.id);

        // Also log to notification_logs for admin visibility
        await supabase.from("notification_logs").insert({
          booking_id: notification.booking_id,
          notification_type: notification.notification_type,
          status: "sent",
          recipient: notification.recipient,
          external_id: result.id || result.sid,
        });

        succeeded++;
        console.log(`[process-notifications] ✅ ${notification.notification_type} sent for ${notification.booking_id}`);
      } else {
        // For sandbox mode customer WhatsApp, mark as skipped (not exhausted)
        const isSandboxSkip =
          whatsappMode === "sandbox" && notification.notification_type === "whatsapp" && isCustomerNotification;

        if (isSandboxSkip) {
          // Mark as sent with note about sandbox mode
          await supabase
            .from("notification_queue")
            .update({
              status: "sent",
              attempts: newAttempts,
              last_error: "Skipped - sandbox mode (customer receives email)",
              sent_at: new Date().toISOString(),
            })
            .eq("id", notification.id);

          // Log for admin visibility
          await supabase.from("notification_logs").insert({
            booking_id: notification.booking_id,
            notification_type: notification.notification_type,
            status: "sent",
            recipient: notification.recipient,
            message_content: "Skipped - sandbox mode",
          });

          console.log(`[process-notifications] ⏭️ WhatsApp skipped for customer (sandbox mode)`);
          succeeded++; // Count as success since expected behavior
        } else {
          // Failure - schedule retry with exponential backoff
          const nextRetryDelay = BASE_DELAY_SECONDS * Math.pow(BACKOFF_MULTIPLIER, newAttempts);
          const nextRetryAt = new Date(Date.now() + nextRetryDelay * 1000);
          const newStatus = newAttempts >= 3 ? "exhausted" : "failed";

          await supabase
            .from("notification_queue")
            .update({
              status: newStatus,
              attempts: newAttempts,
              next_retry_at: nextRetryAt.toISOString(),
              last_error: result.error,
            })
            .eq("id", notification.id);

          // Log failure
          await supabase.from("notification_logs").insert({
            booking_id: notification.booking_id,
            notification_type: notification.notification_type,
            status: "failed",
            recipient: notification.recipient,
            error_message: result.error,
          });

          failed++;
          console.log(`[process-notifications] ❌ ${notification.notification_type} failed: ${result.error}`);
        }
      }

      processed++;
    }

    console.log(`[process-notifications] Completed: ${processed} processed, ${succeeded} succeeded, ${failed} failed`);

    return new Response(JSON.stringify({ success: true, processed, succeeded, failed, whatsappMode }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("[process-notifications] Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
