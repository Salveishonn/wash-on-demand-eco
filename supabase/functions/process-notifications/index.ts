import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ============================================================
// PROCESS NOTIFICATIONS - Meta Cloud API (Primary) + Resend Email
// ============================================================
// Processes notification queue and sends via appropriate channel
// WhatsApp: Meta Cloud API (primary), Twilio (fallback)
// Email: Resend
// Production number: +54 9 11 7624 7835
// ============================================================

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BACKOFF_MULTIPLIER = 2;
const BASE_DELAY_SECONDS = 60;

// Admin WhatsApp number for notifications - centralized
const ADMIN_WHATSAPP = "+5491176247835";

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

function normalizePhoneForMeta(phone: string): string {
  // Meta expects phone without + prefix, just digits
  return phone.replace(/[^0-9]/g, "");
}

function normalizePhoneE164(phone: string): string {
  let normalized = phone.replace(/[^0-9]/g, "");
  // Handle Argentina mobile numbers
  if (normalized.startsWith("15")) {
    normalized = "5411" + normalized.substring(2);
  } else if (normalized.length === 10 && !normalized.startsWith("54")) {
    normalized = "54" + normalized;
  } else if (!normalized.startsWith("54") && normalized.length < 13) {
    normalized = "54" + normalized;
  }
  return "+" + normalized;
}

async function sendEmail(
  resendApiKey: string,
  fromEmail: string,
  to: string,
  subject: string,
  html: string,
): Promise<{ success: boolean; id?: string; error?: string }> {
  try {
    console.log(`[process-notifications] Sending email via Resend to: ${to}`);
    
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [to],
        subject,
        html,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return { success: false, error: data.message || data.name || "Email send failed" };
    }

    return { success: true, id: data.id };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

// Send WhatsApp via Meta Cloud API
async function sendWhatsAppMeta(
  accessToken: string,
  phoneNumberId: string,
  to: string,
  body: string,
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const phoneForMeta = normalizePhoneForMeta(to);
    console.log(`[process-notifications] Sending WhatsApp via Meta to: ${phoneForMeta}`);

    const metaPayload = {
      messaging_product: 'whatsapp',
      to: phoneForMeta,
      type: 'text',
      text: { body },
    };

    const response = await fetch(
      `https://graph.facebook.com/v20.0/${phoneNumberId}/messages`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(metaPayload),
      }
    );

    const result = await response.json();

    if (response.ok && result.messages?.[0]?.id) {
      return { success: true, messageId: result.messages[0].id };
    } else {
      const errorMsg = result.error?.message || 'Meta API error';
      const errorCode = result.error?.code || response.status;
      return { success: false, error: `META_${errorCode}: ${errorMsg}` };
    }
  } catch (err: any) {
    return { success: false, error: `META_ERROR: ${err.message}` };
  }
}

// Send WhatsApp via Twilio (fallback)
async function sendWhatsAppTwilio(
  accountSid: string,
  authToken: string,
  fromNumber: string,
  to: string,
  body: string,
): Promise<{ success: boolean; sid?: string; error?: string }> {
  try {
    const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
    const auth = btoa(`${accountSid}:${authToken}`);

    const normalizedTo = normalizePhoneE164(to);
    const formattedFrom = fromNumber.startsWith('whatsapp:') ? fromNumber : `whatsapp:${fromNumber}`;
    const formattedTo = `whatsapp:${normalizedTo}`;

    console.log(`[process-notifications] Sending WhatsApp via Twilio to: ${formattedTo}`);

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

    if (!response.ok) {
      return { success: false, error: data.message || JSON.stringify(data) };
    }

    return { success: true, sid: data.sid };
  } catch (err: any) {
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
  const resendFromEmail = Deno.env.get("RESEND_FROM_EMAIL") || "Washero <reservas@washero.online>";
  
  // Meta WhatsApp API (PRIMARY)
  const metaAccessToken = Deno.env.get("META_WA_ACCESS_TOKEN");
  const metaPhoneNumberId = Deno.env.get("META_WA_PHONE_NUMBER_ID");
  const metaConfigured = !!(metaAccessToken && metaPhoneNumberId);
  
  // Twilio (FALLBACK)
  const twilioAccountSid = Deno.env.get("TWILIO_ACCOUNT_SID");
  const twilioAuthToken = Deno.env.get("TWILIO_AUTH_TOKEN");
  const twilioWhatsAppNumber = Deno.env.get("TWILIO_WHATSAPP_NUMBER");
  const twilioConfigured = !!(twilioAccountSid && twilioAuthToken && twilioWhatsAppNumber);
  
  // WhatsApp mode - default to meta
  const whatsappMode = Deno.env.get("WHATSAPP_MODE") || "meta";

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    console.log("[process-notifications] Starting notification processing");
    console.log("[process-notifications] Config:", {
      whatsappMode,
      metaConfigured,
      twilioConfigured,
    });

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

    // Rate limiting: add delay between notifications
    const DELAY_BETWEEN_SENDS_MS = 600;

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

      let result: { success: boolean; id?: string; sid?: string; messageId?: string; error?: string };
      let provider = 'none';

      if (notification.notification_type === "email") {
        if (!resendApiKey) {
          result = { success: false, error: "RESEND_API_KEY not configured" };
        } else {
          const html = buildEmailHtml(booking, isCustomerNotification);
          const subject = isCustomerNotification
            ? `✅ Reserva Confirmada - ${formatDate(booking.booking_date)}`
            : `🚗 Nueva Reserva: ${booking.customer_name} - ${formatDate(booking.booking_date)}`;

          result = await sendEmail(resendApiKey, resendFromEmail, notification.recipient, subject, html);
          provider = 'resend';
        }
      } else if (notification.notification_type === "whatsapp") {
        // In sandbox mode, only send to admin number
        if (whatsappMode === "sandbox" && isCustomerNotification) {
          result = {
            success: false,
            error: "WhatsApp in sandbox mode - customer messages not sent.",
          };
          console.log(`[process-notifications] Skipping customer WhatsApp in sandbox mode`);
        } 
        // Try Meta first (primary provider)
        else if ((whatsappMode === "meta" || whatsappMode === "production") && metaConfigured) {
          provider = 'meta';
          const message = buildWhatsAppMessage(booking, isCustomerNotification);
          const metaResult = await sendWhatsAppMeta(
            metaAccessToken!,
            metaPhoneNumberId!,
            notification.recipient,
            message
          );
          result = { 
            success: metaResult.success, 
            id: metaResult.messageId, 
            error: metaResult.error 
          };
        }
        // Fallback to Twilio
        else if (twilioConfigured) {
          provider = 'twilio';
          const message = buildWhatsAppMessage(booking, isCustomerNotification);
          const twilioResult = await sendWhatsAppTwilio(
            twilioAccountSid!,
            twilioAuthToken!,
            twilioWhatsAppNumber!,
            notification.recipient,
            message
          );
          result = { 
            success: twilioResult.success, 
            sid: twilioResult.sid, 
            error: twilioResult.error 
          };
        } else {
          result = { success: false, error: "No WhatsApp provider configured" };
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
            external_id: result.id || result.sid || result.messageId,
            sent_at: new Date().toISOString(),
            last_error: null,
          })
          .eq("id", notification.id);

        // Log to notification_logs
        await supabase.from("notification_logs").insert({
          booking_id: notification.booking_id,
          notification_type: notification.notification_type,
          status: "sent",
          recipient: notification.recipient,
          external_id: result.id || result.sid || result.messageId,
          message_type: provider,
        });

        succeeded++;
        console.log(`[process-notifications] ✅ ${notification.notification_type} sent via ${provider}`);
      } else {
        // For sandbox mode customer WhatsApp, mark as skipped
        const isSandboxSkip =
          whatsappMode === "sandbox" && notification.notification_type === "whatsapp" && isCustomerNotification;

        if (isSandboxSkip) {
          await supabase
            .from("notification_queue")
            .update({
              status: "sent",
              attempts: newAttempts,
              last_error: "Skipped - sandbox mode",
              sent_at: new Date().toISOString(),
            })
            .eq("id", notification.id);

          await supabase.from("notification_logs").insert({
            booking_id: notification.booking_id,
            notification_type: notification.notification_type,
            status: "sent",
            recipient: notification.recipient,
            message_content: "Skipped - sandbox mode",
          });

          console.log(`[process-notifications] ⏭️ WhatsApp skipped (sandbox mode)`);
          succeeded++;
        } else {
          // Failure - schedule retry
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
