import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const formatPrice = (cents: number) => {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 0,
  }).format(cents / 100);
};

interface SendPaymentEmailRequest {
  subscription_id: string;
  cycle_month?: string; // Format: YYYY-MM
  mode?: "manual" | "auto";
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const resendApiKey = Deno.env.get("RESEND_API_KEY");
  const resendFromEmail = Deno.env.get("RESEND_FROM_EMAIL") || "Washero <reservas@washero.online>";

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const { subscription_id, cycle_month, mode = "manual" }: SendPaymentEmailRequest = await req.json();

    console.log("[admin-send-subscription-payment-email] Request:", { subscription_id, cycle_month, mode });

    if (!subscription_id) {
      throw new Error("subscription_id es requerido");
    }

    if (!resendApiKey) {
      throw new Error("RESEND_API_KEY no configurado");
    }

    // Get subscription with plan
    const { data: subscription, error: fetchError } = await supabase
      .from("subscriptions")
      .select(`
        *,
        subscription_plans (
          name,
          washes_per_month,
          price_cents
        )
      `)
      .eq("id", subscription_id)
      .single();

    if (fetchError || !subscription) {
      console.error("[admin-send-subscription-payment-email] Fetch error:", fetchError);
      throw new Error("Suscripción no encontrada");
    }

    if (!subscription.customer_email) {
      throw new Error("El cliente no tiene email configurado");
    }

    const plan = subscription.subscription_plans;
    if (!plan) {
      throw new Error("Plan no encontrado");
    }

    // Get payment settings
    const { data: paymentSettings } = await supabase
      .from("payment_settings")
      .select("*")
      .eq("is_enabled", true)
      .single();

    if (!paymentSettings) {
      throw new Error("Configuración de pago no encontrada. Configure el alias de MercadoPago en el panel de admin.");
    }

    // Determine cycle
    const now = new Date();
    const targetMonth = cycle_month || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

    // Create payment reference
    const paymentRef = `SUSC-${subscription_id.substring(0, 8).toUpperCase()}-${targetMonth.replace("-", "")}`;

    // Optionally create a payment_intent for tracking
    const { data: paymentIntent } = await supabase
      .from("payment_intents")
      .insert({
        subscription_id,
        amount_ars: plan.price_cents,
        type: "subscription_monthly",
        status: "pending",
      })
      .select()
      .single();

    const siteUrl = Deno.env.get("SITE_URL") || "https://washero.online";
    const paymentUrl = paymentIntent ? `${siteUrl}/pagar/${paymentIntent.id}` : paymentSettings.mp_payment_link;

    // Build email
    const subject = `💳 Suscripción Washero - Pago ${targetMonth}`;
    const html = buildSubscriptionPaymentEmail(
      subscription.customer_name || "Cliente",
      plan.name,
      plan.price_cents,
      targetMonth,
      paymentRef,
      paymentSettings,
      paymentUrl
    );

    // Send email via Resend
    console.log("[admin-send-subscription-payment-email] Sending email to:", subscription.customer_email);
    
    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: resendFromEmail,
        to: [subscription.customer_email],
        subject,
        html,
      }),
    });

    const emailData = await emailResponse.json();
    console.log("[admin-send-subscription-payment-email] Resend response:", emailData);

    if (!emailResponse.ok) {
      throw new Error(emailData.message || emailData.name || "Error al enviar email");
    }

    // Log notification
    await supabase.from("notification_logs").insert({
      recipient: subscription.customer_email,
      notification_type: "email",
      message_type: "subscription_payment",
      message_content: `Pago suscripción ${plan.name} - ${targetMonth}`,
      status: "sent",
      external_id: emailData.id,
    });

    // Log event
    await supabase.from("subscription_events").insert({
      subscription_id,
      event_type: "payment_email_sent",
      payload: {
        cycle_month: targetMonth,
        amount: plan.price_cents,
        mode,
        email_id: emailData.id,
      },
    });

    console.log("[admin-send-subscription-payment-email] Email sent successfully");

    return new Response(
      JSON.stringify({
        success: true,
        message: `Email de pago enviado a ${subscription.customer_email}`,
        email_id: emailData.id,
        payment_intent_id: paymentIntent?.id,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("[admin-send-subscription-payment-email] Error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

function buildSubscriptionPaymentEmail(
  customerName: string,
  planName: string,
  priceCents: number,
  cycleMonth: string,
  paymentRef: string,
  paymentSettings: any,
  paymentUrl: string
): string {
  const priceFormatted = formatPrice(priceCents);
  const [year, month] = cycleMonth.split("-");
  const monthNames = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
  const monthName = monthNames[parseInt(month) - 1] || month;

  return `
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
    .reference-code { font-weight: bold; color: #856404; font-family: monospace; font-size: 16px; }
    .plan-info { background: #f0f0f0; padding: 15px; border-radius: 8px; margin: 15px 0; }
    .plan-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #ddd; }
    .plan-row:last-child { border-bottom: none; }
    .cta { background: #E8F5E9; border-radius: 8px; padding: 20px; margin: 25px 0; text-align: center; }
    .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; background: #f9f9f9; border-radius: 0 0 10px 10px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>💳 Pago de Suscripción</h1>
      <p>${monthName} ${year}</p>
    </div>
    <div class="content">
      <p class="greeting">Hola ${customerName},</p>
      <p>Es momento de renovar tu suscripción Washero para seguir disfrutando de tus lavados mensuales.</p>
      
      <div class="amount-box">
        <p class="amount-label">Total a pagar</p>
        <p class="amount">${priceFormatted}</p>
      </div>
      
      <div class="plan-info">
        <div class="plan-row">
          <span>Plan</span>
          <strong>${planName}</strong>
        </div>
        <div class="plan-row">
          <span>Período</span>
          <strong>${monthName} ${year}</strong>
        </div>
      </div>
      
      <div class="section">
        <h3>💳 Cómo Pagar</h3>
        
        <div class="payment-method">
          <h4>Opción 1: Pagar Online (Recomendado)</h4>
          <p>Hacé clic en el siguiente botón para ver las instrucciones de pago:</p>
          <a href="${paymentUrl}" class="payment-link" target="_blank">Pagar con MercadoPago →</a>
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
        <p>⚠️ <strong>Importante:</strong> Incluí esta referencia en el concepto de la transferencia:</p>
        <p style="margin-top: 10px;"><span class="reference-code">${paymentRef}</span></p>
      </div>
      
      <div class="cta">
        <p>✉️ Cuando hagas el pago, <strong>respondé este email con el comprobante</strong> para confirmar.</p>
      </div>
    </div>
    <div class="footer">
      <p>© ${new Date().getFullYear()} Washero - Lavado Premium a Domicilio</p>
      <p>Si tenés dudas, respondé este email o contactanos por WhatsApp.</p>
    </div>
  </div>
</body>
</html>
  `;
}
