import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SendNotificationsRequest {
  bookingId?: string;
  messageType?: "booking_confirmation" | "payment_instructions" | "test";
  testMode?: boolean;
  testEmailTo?: string;
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

const formatShortDate = (date: string) => {
  return new Date(date).toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
};

// Normalize phone number to E.164 format
function normalizePhoneNumber(phone: string): string {
  let normalized = phone.replace(/[\s\-\(\)]/g, "");
  if (normalized.toLowerCase().startsWith("whatsapp:")) {
    normalized = normalized.substring(9);
  }
  if (!normalized.startsWith("+")) {
    if (normalized.startsWith("54")) {
      normalized = "+" + normalized;
    } else {
      normalized = "+54" + normalized;
    }
  }
  return normalized;
}

function formatWhatsAppNumber(phone: string): string {
  const normalized = normalizePhoneNumber(phone);
  return `whatsapp:${normalized}`;
}

function getTwilioFromNumber(envVar: string | undefined): string {
  if (!envVar) {
    return "whatsapp:+14155238886";
  }
  if (envVar.toLowerCase().startsWith("whatsapp:")) {
    return envVar;
  }
  return `whatsapp:${envVar.startsWith("+") ? envVar : "+" + envVar}`;
}

async function sendResendEmail(apiKey: string, fromEmail: string, to: string, subject: string, html: string) {
  console.log(`[send-notifications] Sending email via Resend to: ${to}`);
  
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
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
  console.log(`[send-notifications] Resend response:`, JSON.stringify(data));

  if (!response.ok) {
    throw new Error(data.message || data.name || "Error sending email");
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
      return { success: true, sid: data.sid, status: data.status, from, to };
    } else {
      return { success: false, error: data.message || `Twilio error: ${data.code}`, from, to };
    }
  } catch (error: any) {
    console.error(`[send-notifications] Twilio fetch error:`, error);
    return { success: false, error: error.message, from, to };
  }
}

// Build payment instructions email for customer
function buildPaymentInstructionsEmail(booking: any, paymentSettings: any, paymentUrl?: string): { subject: string; html: string } {
  const totalCents = booking.service_price_cents + (booking.car_type_extra_cents || 0);
  const totalFormatted = formatPrice(totalCents);
  const bookingRef = `WASHERO-${booking.id.substring(0, 8).toUpperCase()}`;
  const dateFormatted = formatShortDate(booking.booking_date);
  
  // Use payment page URL if available, otherwise fall back to MP link
  const payLink = paymentUrl || paymentSettings.mp_payment_link;
  
  const subject = `Pago pendiente — Reserva Washero ${dateFormatted}`;
  
  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background: #f5f5f5; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #1a1a1a 0%, #333 100%); color: #FFD700; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
    .header h1 { margin: 0; font-size: 24px; }
    .header p { margin: 10px 0 0; opacity: 0.9; font-size: 14px; }
    .content { background: white; padding: 30px; }
    .greeting { font-size: 18px; margin-bottom: 20px; }
    .amount-box { background: #FFF8E1; border: 2px solid #FFD700; border-radius: 10px; padding: 20px; text-align: center; margin: 20px 0; }
    .amount { font-size: 36px; font-weight: bold; color: #1a1a1a; margin: 0; }
    .amount-label { color: #666; font-size: 14px; margin-bottom: 5px; }
    .section { margin: 25px 0; }
    .section h3 { color: #1a1a1a; font-size: 16px; margin-bottom: 15px; border-bottom: 2px solid #FFD700; padding-bottom: 8px; }
    .payment-method { background: #f9f9f9; border-radius: 8px; padding: 20px; margin: 10px 0; }
    .payment-method h4 { margin: 0 0 10px; color: #333; font-size: 15px; }
    .payment-link { display: inline-block; background: #009EE3; color: white !important; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-weight: 600; margin: 10px 0; }
    .alias-box { background: #e8f4fc; padding: 15px; border-radius: 6px; text-align: center; margin: 10px 0; }
    .alias { font-size: 20px; font-weight: bold; color: #009EE3; font-family: monospace; letter-spacing: 1px; }
    .reference-box { background: #FFF3CD; border: 1px solid #FFE69C; border-radius: 6px; padding: 15px; margin: 20px 0; }
    .reference-box p { margin: 0; font-size: 14px; }
    .reference-code { font-weight: bold; color: #856404; font-family: monospace; font-size: 16px; }
    .booking-details { background: #f9f9f9; padding: 15px; border-radius: 6px; margin: 15px 0; }
    .detail-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #eee; }
    .detail-row:last-child { border-bottom: none; }
    .label { color: #666; }
    .value { font-weight: 600; }
    .cta { background: #E8F5E9; border-radius: 8px; padding: 20px; margin: 25px 0; text-align: center; }
    .cta p { margin: 0; color: #2E7D32; font-size: 15px; }
    .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; background: #f9f9f9; border-radius: 0 0 10px 10px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>💳 Instrucciones de Pago</h1>
      <p>Reserva ${bookingRef}</p>
    </div>
    <div class="content">
      <p class="greeting">Hola ${booking.customer_name},</p>
      <p>¡Gracias por elegir Washero! Tu reserva está confirmada. Para completarla, realizá el pago por el siguiente monto:</p>
      
      <div class="amount-box">
        <p class="amount-label">Total a pagar</p>
        <p class="amount">${totalFormatted}</p>
      </div>
      
      <div class="section">
        <h3>💳 Cómo Pagar</h3>
        
        <div class="payment-method">
          <h4>Opción 1: Pagar ahora (Recomendado)</h4>
          <p>Hacé clic en el siguiente botón para ver las instrucciones de pago:</p>
          <a href="${payLink}" class="payment-link" target="_blank">Pagar con MercadoPago →</a>
        </div>
        
        <div class="payment-method">
          <h4>Opción 2: Transferencia a Alias</h4>
          <p>Transferí desde tu banco o billetera digital al siguiente alias:</p>
          <div class="alias-box">
            <span class="alias">${paymentSettings.mp_alias}</span>
          </div>
          ${paymentSettings.mp_holder_name ? `<p style="margin: 5px 0; color: #666; font-size: 13px;">Titular: ${paymentSettings.mp_holder_name}</p>` : ''}
          ${paymentSettings.mp_cvu ? `<p style="margin: 5px 0; color: #666; font-size: 13px;">CVU: ${paymentSettings.mp_cvu}</p>` : ''}
        </div>
      </div>
      
      <div class="reference-box">
        <p>⚠️ <strong>Importante:</strong> Incluí esta referencia en el concepto o mensaje de la transferencia:</p>
        <p style="margin-top: 10px;"><span class="reference-code">${bookingRef}</span></p>
      </div>
      
      <div class="section">
        <h3>📋 Tu Reserva</h3>
        <div class="booking-details">
          <div class="detail-row">
            <span class="label">Servicio</span>
            <span class="value">${booking.service_name}</span>
          </div>
          <div class="detail-row">
            <span class="label">Vehículo</span>
            <span class="value">${booking.car_type || 'Estándar'}</span>
          </div>
          <div class="detail-row">
            <span class="label">Fecha</span>
            <span class="value">${formatDate(booking.booking_date)}</span>
          </div>
          <div class="detail-row">
            <span class="label">Horario</span>
            <span class="value">${booking.booking_time} hs</span>
          </div>
          <div class="detail-row">
            <span class="label">Dirección</span>
            <span class="value">${booking.address || 'A confirmar'}</span>
          </div>
        </div>
      </div>
      
      <div class="cta">
        <p>✉️ Cuando hagas el pago, <strong>respondé este email con el comprobante</strong> para confirmar tu reserva.</p>
      </div>
      
      ${paymentSettings.mp_notes ? `<p style="color: #666; font-size: 13px; margin-top: 20px;">📝 ${paymentSettings.mp_notes}</p>` : ''}
    </div>
    <div class="footer">
      <p>© ${new Date().getFullYear()} Washero - Lavado Premium a Domicilio</p>
      <p>Si tenés dudas, respondé este email o contactanos por WhatsApp.</p>
    </div>
  </div>
</body>
</html>
  `;
  
  return { subject, html };
}

// Build admin notification email
function buildAdminNotificationEmail(booking: any): { subject: string; html: string; plainText: string } {
  const totalPrice = booking.service_price_cents + (booking.car_type_extra_cents || 0);
  
  const plainText = `
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

  const subject = `🚗 Nueva Reserva: ${booking.customer_name} - ${formatDate(booking.booking_date)}`;
  
  const html = `
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
        <div class="detail-row"><span class="label">Servicio</span><span class="value">${booking.service_name}</span></div>
        <div class="detail-row"><span class="label">Vehículo</span><span class="value">${booking.car_type || "No especificado"}</span></div>
        <div class="detail-row"><span class="label">Total</span><span class="price">${formatPrice(totalPrice)}</span></div>
      </div>
      <div class="section">
        <h3>👤 Cliente</h3>
        <div class="detail-row"><span class="label">Nombre</span><span class="value">${booking.customer_name}</span></div>
        <div class="detail-row"><span class="label">Email</span><span class="value">${booking.customer_email}</span></div>
        <div class="detail-row"><span class="label">Teléfono</span><span class="value">${booking.customer_phone}</span></div>
      </div>
      <div class="section">
        <h3>📅 Fecha y Hora</h3>
        <div class="detail-row"><span class="label">Fecha</span><span class="value">${formatDate(booking.booking_date)}</span></div>
        <div class="detail-row"><span class="label">Horario</span><span class="value">${booking.booking_time} hs</span></div>
      </div>
      <div class="section">
        <h3>📍 Ubicación</h3>
        <p style="margin: 0;">${booking.address || "No especificada"}</p>
      </div>
      ${booking.notes ? `<div class="section"><h3>📝 Notas</h3><p style="margin: 0;">${booking.notes}</p></div>` : ""}
      <div class="section">
        <h3>💳 Estado del Pago</h3>
        <span class="status-badge ${booking.payment_status === "approved" ? "status-approved" : booking.is_subscription_booking ? "status-subscription" : "status-pending"}">
          ${booking.payment_status === "approved" ? "✅ Pagado" : booking.is_subscription_booking ? "🔄 Suscripción" : "⏳ Pendiente"}
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
  
  return { subject, html, plainText };
}

serve(async (req) => {
  console.log("[send-notifications] ====== FUNCTION INVOKED ======");
  console.log(`[send-notifications] Method: ${req.method}`);
  
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const resendApiKey = Deno.env.get("RESEND_API_KEY");
  const resendFromEmail = Deno.env.get("RESEND_FROM_EMAIL") || "Washero <reservas@washero.online>";
  const twilioAccountSid = Deno.env.get("TWILIO_ACCOUNT_SID");
  const twilioAuthToken = Deno.env.get("TWILIO_AUTH_TOKEN");
  const twilioWhatsAppNumber = Deno.env.get("TWILIO_WHATSAPP_NUMBER");
  const emailMode = Deno.env.get("EMAIL_MODE") || "production";

  console.log("[send-notifications] EMAIL_MODE:", emailMode);
  console.log("[send-notifications] RESEND_FROM_EMAIL:", resendFromEmail);

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const body = await req.json();
    const { bookingId, messageType, testMode, testEmailTo }: SendNotificationsRequest = body;

    console.log(`[send-notifications] Request:`, JSON.stringify(body));

    const results = { email: null as any, whatsapp: null as any, customerEmail: null as any };

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

      const testEmailRecipient = testEmailTo || ADMIN_EMAIL;
      if (resendApiKey) {
        try {
          const emailResponse = await sendResendEmail(resendApiKey, resendFromEmail, testEmailRecipient, "🧪 Test Notification - Washero", testEmailHtml);
          await supabase.from("notification_logs").insert({
            booking_id: null,
            notification_type: "email",
            message_type: "test",
            status: "sent",
            recipient: testEmailRecipient,
            message_content: `Test notification`,
            external_id: emailResponse.id,
          });
          results.email = { success: true, id: emailResponse.id };
        } catch (emailError: any) {
          console.error("[send-notifications] Test email error:", emailError);
          await supabase.from("notification_logs").insert({
            booking_id: null,
            notification_type: "email",
            message_type: "test",
            status: "failed",
            recipient: testEmailRecipient,
            error_message: emailError.message,
          });
          results.email = { success: false, error: emailError.message };
        }
      } else {
        results.email = { success: false, error: "RESEND_API_KEY not configured" };
      }

      if (twilioAccountSid && twilioAuthToken) {
        const whatsappResult = await sendTwilioWhatsApp(twilioAccountSid, twilioAuthToken, twilioWhatsAppNumber || "", ADMIN_WHATSAPP, testMessage);
        await supabase.from("notification_logs").insert({
          booking_id: null,
          notification_type: "whatsapp",
          message_type: "test",
          status: whatsappResult.success ? "sent" : "failed",
          recipient: whatsappResult.to,
          message_content: `Test notification`,
          external_id: whatsappResult.sid || null,
          error_message: whatsappResult.error || null,
        });
        results.whatsapp = whatsappResult.success ? { success: true, sid: whatsappResult.sid } : { success: false, error: whatsappResult.error };
      } else {
        results.whatsapp = { success: false, error: "Twilio credentials not configured" };
      }

      return new Response(JSON.stringify({ success: true, results, testMode: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ===== BOOKING MODE =====
    if (!bookingId) {
      throw new Error("bookingId is required when not in testMode");
    }

    console.log(`[send-notifications] Processing booking: ${bookingId}, messageType: ${messageType || 'booking_confirmation'}`);

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

    console.log(`[send-notifications] Booking found: ${booking.customer_name}, email: ${booking.customer_email}`);

    // ===== PAYMENT INSTRUCTIONS MODE =====
    if (messageType === "payment_instructions") {
      console.log("[send-notifications] Sending payment instructions to customer");
      
      // Check if customer has email
      if (!booking.customer_email) {
        await supabase.from("notification_logs").insert({
          booking_id: bookingId,
          notification_type: "email",
          message_type: "payment_instructions",
          status: "blocked",
          recipient: "N/A",
          error_message: "missing_customer_email",
        });
        return new Response(JSON.stringify({ success: false, error: "missing_customer_email" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Fetch payment settings
      const { data: paymentSettings, error: settingsError } = await supabase
        .from("payment_settings")
        .select("*")
        .eq("is_enabled", true)
        .maybeSingle();

      if (settingsError || !paymentSettings) {
        console.error("[send-notifications] Payment settings not found or disabled:", settingsError);
        await supabase.from("notification_logs").insert({
          booking_id: bookingId,
          notification_type: "email",
          message_type: "payment_instructions",
          status: "blocked",
          recipient: booking.customer_email,
          error_message: "payment_settings_disabled_or_missing",
        });
        return new Response(JSON.stringify({ success: false, error: "payment_settings_disabled_or_missing" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      console.log("[send-notifications] Payment settings found:", paymentSettings.mp_alias);

      // Build customer email
      const { subject, html } = buildPaymentInstructionsEmail(booking, paymentSettings);
      
      // Determine recipient based on EMAIL_MODE
      let customerRecipient = booking.customer_email;
      let wasBlocked = false;
      
      if (emailMode === "sandbox") {
        console.log(`[send-notifications] EMAIL_MODE=sandbox, would send to ${customerRecipient} but sending to admin instead`);
        customerRecipient = ADMIN_EMAIL;
        wasBlocked = true;
      }

      if (!resendApiKey) {
        await supabase.from("notification_logs").insert({
          booking_id: bookingId,
          notification_type: "email",
          message_type: "payment_instructions",
          status: "failed",
          recipient: booking.customer_email,
          error_message: "RESEND_API_KEY not configured",
        });
        return new Response(JSON.stringify({ success: false, error: "RESEND_API_KEY not configured" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      try {
        const emailResponse = await sendResendEmail(resendApiKey, resendFromEmail, customerRecipient, subject, html);
        
        await supabase.from("notification_logs").insert({
          booking_id: bookingId,
          notification_type: "email",
          message_type: "payment_instructions",
          status: wasBlocked ? "blocked" : "sent",
          recipient: booking.customer_email, // Log intended recipient
          message_content: `Payment instructions | Sent to: ${customerRecipient}`,
          external_id: emailResponse.id,
          error_message: wasBlocked ? `sandbox_mode_sent_to_admin` : null,
        });

        results.customerEmail = { 
          success: true, 
          id: emailResponse.id, 
          to: customerRecipient,
          intendedTo: booking.customer_email,
          blocked: wasBlocked 
        };
        
        console.log(`[send-notifications] Payment instructions sent successfully to ${customerRecipient}`);
      } catch (emailError: any) {
        console.error("[send-notifications] Payment instructions email error:", emailError);
        await supabase.from("notification_logs").insert({
          booking_id: bookingId,
          notification_type: "email",
          message_type: "payment_instructions",
          status: "failed",
          recipient: booking.customer_email,
          error_message: emailError.message,
        });
        results.customerEmail = { success: false, error: emailError.message };
      }

      return new Response(JSON.stringify({ success: results.customerEmail?.success || false, results }), {
        status: results.customerEmail?.success ? 200 : 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ===== BOOKING CONFIRMATION MODE (Admin notification) =====
    const { subject, html, plainText } = buildAdminNotificationEmail(booking);

    // Send Email to Admin
    if (resendApiKey) {
      try {
        const emailResponse = await sendResendEmail(resendApiKey, resendFromEmail, ADMIN_EMAIL, subject, html);
        await supabase.from("notification_logs").insert({
          booking_id: bookingId,
          notification_type: "email",
          message_type: "booking_confirmation",
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
          message_type: "booking_confirmation",
          status: "failed",
          recipient: ADMIN_EMAIL,
          error_message: emailError.message,
        });
        results.email = { success: false, error: emailError.message };
      }
    } else {
      console.warn("[send-notifications] RESEND_API_KEY not configured");
    }

    // Send WhatsApp to Admin
    if (twilioAccountSid && twilioAuthToken) {
      const whatsappResult = await sendTwilioWhatsApp(twilioAccountSid, twilioAuthToken, twilioWhatsAppNumber || "", ADMIN_WHATSAPP, plainText);
      await supabase.from("notification_logs").insert({
        booking_id: bookingId,
        notification_type: "whatsapp",
        message_type: "booking_confirmation",
        status: whatsappResult.success ? "sent" : "failed",
        recipient: whatsappResult.to,
        message_content: plainText.substring(0, 500),
        external_id: whatsappResult.sid || null,
        error_message: whatsappResult.error || null,
      });
      results.whatsapp = whatsappResult.success ? { success: true, sid: whatsappResult.sid } : { success: false, error: whatsappResult.error };
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
