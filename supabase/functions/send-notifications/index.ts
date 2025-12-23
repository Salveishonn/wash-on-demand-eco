import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SendNotificationsRequest {
  bookingId?: string;
  testMode?: boolean;
}

// Admin recipients
const ADMIN_EMAIL = "washerocarwash@gmail.com";
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

// Normalize phone number to E.164 format
function normalizePhoneNumber(phone: string): string {
  let normalized = phone.replace(/[\s\-\(\)]/g, "");
  
  // Remove whatsapp: prefix if present
  if (normalized.toLowerCase().startsWith("whatsapp:")) {
    normalized = normalized.substring(9);
  }
  
  // Ensure starts with +
  if (!normalized.startsWith("+")) {
    // Assume Argentina if no country code
    if (normalized.startsWith("54")) {
      normalized = "+" + normalized;
    } else {
      normalized = "+54" + normalized;
    }
  }
  
  return normalized;
}

// Format phone number for Twilio WhatsApp API
function formatWhatsAppNumber(phone: string): string {
  const normalized = normalizePhoneNumber(phone);
  return `whatsapp:${normalized}`;
}

// Get Twilio From number, ensuring correct format
function getTwilioFromNumber(envVar: string | undefined): string {
  if (!envVar) {
    return "whatsapp:+14155238886"; // Default sandbox number
  }
  
  // If already has whatsapp: prefix, return as-is
  if (envVar.toLowerCase().startsWith("whatsapp:")) {
    return envVar;
  }
  
  // Otherwise add the prefix
  return `whatsapp:${envVar.startsWith("+") ? envVar : "+" + envVar}`;
}

async function sendResendEmail(apiKey: string, to: string, subject: string, html: string) {
  console.log(`[send-notifications] Sending email via Resend to: ${to}`);
  
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
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
  console.log(`[send-notifications] Resend response:`, JSON.stringify(data));

  if (!response.ok) {
    throw new Error(data.message || "Error sending email");
  }

  return data;
}

async function sendTwilioWhatsApp(
  accountSid: string,
  authToken: string,
  fromNumber: string,
  toNumber: string,
  message: string
): Promise<{ success: boolean; sid?: string; status?: string; error?: string; from: string; to: string }> {
  const from = getTwilioFromNumber(fromNumber);
  const to = formatWhatsAppNumber(toNumber);
  
  console.log(`[send-notifications] Sending WhatsApp - From: ${from}, To: ${to}`);

  const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
  const auth = btoa(`${accountSid}:${authToken}`);

  try {
    const response = await fetch(twilioUrl, {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        From: from,
        To: to,
        Body: message,
      }),
    });

    const data = await response.json();
    console.log(`[send-notifications] Twilio response:`, JSON.stringify(data));

    if (response.ok) {
      return { 
        success: true, 
        sid: data.sid, 
        status: data.status,
        from,
        to
      };
    } else {
      return { 
        success: false, 
        error: data.message || `Twilio error: ${data.code}`,
        from,
        to
      };
    }
  } catch (error: any) {
    console.error(`[send-notifications] Twilio fetch error:`, error);
    return { 
      success: false, 
      error: error.message,
      from,
      to
    };
  }
}

serve(async (req) => {
  // Log at the VERY TOP to confirm invocation
  console.log("[send-notifications] ====== FUNCTION INVOKED ======");
  console.log(`[send-notifications] Method: ${req.method}`);
  console.log(`[send-notifications] URL: ${req.url}`);
  
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const resendApiKey = Deno.env.get("RESEND_API_KEY");
  const twilioAccountSid = Deno.env.get("TWILIO_ACCOUNT_SID");
  const twilioAuthToken = Deno.env.get("TWILIO_AUTH_TOKEN");
  const twilioWhatsAppNumber = Deno.env.get("TWILIO_WHATSAPP_NUMBER");

  console.log("[send-notifications] Env check - RESEND_API_KEY:", resendApiKey ? "set" : "NOT SET");
  console.log("[send-notifications] Env check - TWILIO_ACCOUNT_SID:", twilioAccountSid ? "set" : "NOT SET");
  console.log("[send-notifications] Env check - TWILIO_AUTH_TOKEN:", twilioAuthToken ? "set" : "NOT SET");
  console.log("[send-notifications] Env check - TWILIO_WHATSAPP_NUMBER:", twilioWhatsAppNumber || "NOT SET");

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const body = await req.json();
    const { bookingId, testMode }: SendNotificationsRequest = body;

    console.log(`[send-notifications] Request body:`, JSON.stringify(body));
    console.log(`[send-notifications] testMode: ${testMode}, bookingId: ${bookingId}`);

    const results = { email: null as any, whatsapp: null as any };

    // ===== TEST MODE =====
    if (testMode === true) {
      console.log("[send-notifications] Running in TEST MODE");
      
      const testMessage = `🧪 *TEST NOTIFICATION*\n\nEste es un mensaje de prueba de Washero.\n\nFecha: ${new Date().toLocaleString("es-AR")}\n\nSi recibís este mensaje, las notificaciones funcionan correctamente. ✅`;
      
      const testEmailHtml = `
        <div style="font-family: sans-serif; padding: 20px; background: #f9f9f9;">
          <div style="background: #1a1a1a; color: #FFD700; padding: 20px; text-align: center; border-radius: 10px 10px 0 0;">
            <h1>🧪 Test Notification</h1>
          </div>
          <div style="background: white; padding: 20px; border-radius: 0 0 10px 10px;">
            <p>Este es un email de prueba de Washero.</p>
            <p>Fecha: ${new Date().toLocaleString("es-AR")}</p>
            <p style="color: green; font-weight: bold;">✅ Si recibís este email, las notificaciones funcionan correctamente.</p>
          </div>
        </div>
      `;

      // Send test email
      if (resendApiKey) {
        try {
          const emailResponse = await sendResendEmail(
            resendApiKey,
            ADMIN_EMAIL,
            "🧪 Test Notification - Washero",
            testEmailHtml
          );

          await supabase.from("notification_logs").insert({
            booking_id: null,
            notification_type: "email",
            status: "sent",
            recipient: ADMIN_EMAIL,
            message_content: "Test notification",
            external_id: emailResponse.id,
          });

          results.email = { success: true, id: emailResponse.id };
        } catch (emailError: any) {
          console.error("[send-notifications] Test email error:", emailError);

          await supabase.from("notification_logs").insert({
            booking_id: null,
            notification_type: "email",
            status: "failed",
            recipient: ADMIN_EMAIL,
            error_message: emailError.message,
          });

          results.email = { success: false, error: emailError.message };
        }
      } else {
        results.email = { success: false, error: "RESEND_API_KEY not configured" };
      }

      // Send test WhatsApp
      if (twilioAccountSid && twilioAuthToken) {
        const whatsappResult = await sendTwilioWhatsApp(
          twilioAccountSid,
          twilioAuthToken,
          twilioWhatsAppNumber || "",
          ADMIN_WHATSAPP,
          testMessage
        );

        await supabase.from("notification_logs").insert({
          booking_id: null,
          notification_type: "whatsapp",
          status: whatsappResult.success ? "sent" : "failed",
          recipient: whatsappResult.to,
          message_content: `Test | From: ${whatsappResult.from} | To: ${whatsappResult.to}`,
          external_id: whatsappResult.sid || null,
          error_message: whatsappResult.error || null,
        });

        if (whatsappResult.success) {
          results.whatsapp = { success: true, sid: whatsappResult.sid, status: whatsappResult.status };
        } else {
          results.whatsapp = { success: false, error: whatsappResult.error };
        }
      } else {
        results.whatsapp = { success: false, error: "Twilio credentials not configured" };
      }

      console.log("[send-notifications] Test results:", JSON.stringify(results));

      return new Response(JSON.stringify({ success: true, results, testMode: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ===== BOOKING MODE =====
    if (!bookingId) {
      throw new Error("bookingId is required when not in testMode");
    }

    console.log(`[send-notifications] Processing booking: ${bookingId}`);

    // Fetch booking details
    const { data: booking, error: bookingError } = await supabase
      .from("bookings")
      .select("*")
      .eq("id", bookingId)
      .maybeSingle();

    if (bookingError || !booking) {
      console.error("[send-notifications] Booking not found:", bookingError);
      throw new Error("Reserva no encontrada");
    }

    console.log(`[send-notifications] Booking found: ${booking.customer_name}, email: ${booking.customer_email}, phone: ${booking.customer_phone}`);

    const totalPrice = booking.service_price_cents + (booking.car_type_extra_cents || 0);

    const messageContent = `
🚗 *NUEVA RESERVA WASHERO*

📋 *Detalles de la Reserva*
• ID: ${booking.id.substring(0, 8).toUpperCase()}
• Servicio: ${booking.service_name}
• Tipo de vehículo: ${booking.car_type || "No especificado"}
• Precio total: ${formatPrice(totalPrice)}

👤 *Cliente*
• Nombre: ${booking.customer_name}
• Email: ${booking.customer_email}
• Teléfono: ${booking.customer_phone}

📅 *Fecha y Hora*
• ${formatDate(booking.booking_date)}
• Horario: ${booking.booking_time} hs

📍 *Ubicación*
${booking.address || "No especificada"}

${booking.notes ? `📝 *Notas*\n${booking.notes}` : ""}

💳 *Estado del Pago*
${booking.payment_status === "approved" ? "✅ Pagado" : booking.is_subscription_booking ? "🔄 Suscripción" : "⏳ Pendiente"}

⏰ Reserva creada: ${new Date(booking.created_at).toLocaleString("es-AR")}
    `.trim();

    const emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #1a1a1a; color: #FFD700; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
    .header h1 { margin: 0; font-size: 28px; }
    .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
    .section { margin-bottom: 25px; }
    .section h3 { color: #1a1a1a; margin-bottom: 10px; font-size: 16px; border-bottom: 2px solid #FFD700; padding-bottom: 5px; }
    .detail-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #eee; }
    .label { color: #666; }
    .value { font-weight: 600; color: #1a1a1a; }
    .price { font-size: 24px; color: #FFD700; font-weight: bold; }
    .status-badge { display: inline-block; padding: 5px 15px; border-radius: 20px; font-size: 12px; font-weight: 600; }
    .status-approved { background: #10B981; color: white; }
    .status-pending { background: #F59E0B; color: white; }
    .status-subscription { background: #3B82F6; color: white; }
    .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🚗 Nueva Reserva Washero</h1>
      <p style="margin: 10px 0 0 0; opacity: 0.9;">ID: ${booking.id.substring(0, 8).toUpperCase()}</p>
    </div>
    <div class="content">
      <div class="section">
        <h3>📋 Servicio</h3>
        <div class="detail-row">
          <span class="label">Servicio</span>
          <span class="value">${booking.service_name}</span>
        </div>
        <div class="detail-row">
          <span class="label">Vehículo</span>
          <span class="value">${booking.car_type || "No especificado"}</span>
        </div>
        <div class="detail-row">
          <span class="label">Total</span>
          <span class="price">${formatPrice(totalPrice)}</span>
        </div>
      </div>
      
      <div class="section">
        <h3>👤 Cliente</h3>
        <div class="detail-row">
          <span class="label">Nombre</span>
          <span class="value">${booking.customer_name}</span>
        </div>
        <div class="detail-row">
          <span class="label">Email</span>
          <span class="value">${booking.customer_email}</span>
        </div>
        <div class="detail-row">
          <span class="label">Teléfono</span>
          <span class="value">${booking.customer_phone}</span>
        </div>
      </div>
      
      <div class="section">
        <h3>📅 Fecha y Hora</h3>
        <div class="detail-row">
          <span class="label">Fecha</span>
          <span class="value">${formatDate(booking.booking_date)}</span>
        </div>
        <div class="detail-row">
          <span class="label">Horario</span>
          <span class="value">${booking.booking_time} hs</span>
        </div>
      </div>
      
      <div class="section">
        <h3>📍 Ubicación</h3>
        <p style="margin: 0;">${booking.address || "No especificada"}</p>
      </div>
      
      ${
        booking.notes
          ? `
      <div class="section">
        <h3>📝 Notas</h3>
        <p style="margin: 0;">${booking.notes}</p>
      </div>
      `
          : ""
      }
      
      <div class="section">
        <h3>💳 Estado del Pago</h3>
        <span class="status-badge ${
          booking.payment_status === "approved"
            ? "status-approved"
            : booking.is_subscription_booking
              ? "status-subscription"
              : "status-pending"
        }">
          ${
            booking.payment_status === "approved"
              ? "✅ Pagado"
              : booking.is_subscription_booking
                ? "🔄 Suscripción"
                : "⏳ Pendiente"
          }
        </span>
      </div>
    </div>
    <div class="footer">
      <p>Reserva creada: ${new Date(booking.created_at).toLocaleString("es-AR")}</p>
      <p>© ${new Date().getFullYear()} Washero - Lavado Premium a Domicilio</p>
    </div>
  </div>
</body>
</html>
    `;

    // Send Email via Resend
    if (resendApiKey) {
      try {
        const emailResponse = await sendResendEmail(
          resendApiKey,
          ADMIN_EMAIL,
          `🚗 Nueva Reserva: ${booking.customer_name} - ${formatDate(booking.booking_date)}`,
          emailHtml,
        );

        await supabase.from("notification_logs").insert({
          booking_id: bookingId,
          notification_type: "email",
          status: "sent",
          recipient: ADMIN_EMAIL,
          message_content: `Reserva ${booking.id.substring(0, 8)}`,
          external_id: emailResponse.id,
        });

        results.email = { success: true, id: emailResponse.id };
      } catch (emailError: any) {
        console.error("[send-notifications] Email error:", emailError);

        await supabase.from("notification_logs").insert({
          booking_id: bookingId,
          notification_type: "email",
          status: "failed",
          recipient: ADMIN_EMAIL,
          error_message: emailError.message,
        });

        results.email = { success: false, error: emailError.message };
      }
    } else {
      console.warn("[send-notifications] RESEND_API_KEY not configured");
    }

    // Send WhatsApp via Twilio
    if (twilioAccountSid && twilioAuthToken) {
      const whatsappResult = await sendTwilioWhatsApp(
        twilioAccountSid,
        twilioAuthToken,
        twilioWhatsAppNumber || "",
        ADMIN_WHATSAPP,
        messageContent
      );

      await supabase.from("notification_logs").insert({
        booking_id: bookingId,
        notification_type: "whatsapp",
        status: whatsappResult.success ? "sent" : "failed",
        recipient: whatsappResult.to,
        message_content: messageContent.substring(0, 500),
        external_id: whatsappResult.sid || null,
        error_message: whatsappResult.error || null,
      });

      if (whatsappResult.success) {
        results.whatsapp = { success: true, sid: whatsappResult.sid, status: whatsappResult.status };
      } else {
        results.whatsapp = { success: false, error: whatsappResult.error };
      }
    } else {
      console.warn("[send-notifications] Twilio credentials not configured");
    }

    console.log("[send-notifications] Notification results:", JSON.stringify(results));

    return new Response(JSON.stringify({ success: true, results }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("[send-notifications] Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
