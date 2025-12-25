import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface CreateGuestSubscriptionRequest {
  planId: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  paymentMethod: "mercadopago" | "pay_later";
}

const formatPrice = (cents: number) => {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 0,
  }).format(cents / 100);
};

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
    const data: CreateGuestSubscriptionRequest = await req.json();
    
    console.log("[create-guest-subscription] Request:", {
      planId: data.planId,
      email: data.customerEmail,
      paymentMethod: data.paymentMethod,
    });

    // Validate input
    if (!data.planId || !data.customerName || !data.customerEmail || !data.customerPhone) {
      throw new Error("Faltan datos requeridos");
    }

    // Get plan details
    const { data: plan, error: planError } = await supabase
      .from("subscription_plans")
      .select("*")
      .eq("id", data.planId)
      .single();

    if (planError || !plan) {
      console.error("[create-guest-subscription] Plan error:", planError);
      throw new Error("Plan no encontrado");
    }

    console.log("[create-guest-subscription] Plan found:", plan.name);

    // Check for existing active/pending subscription - return it instead of error (idempotent)
    const { data: existingSub } = await supabase
      .from("subscriptions")
      .select("*, subscription_plans(*)")
      .eq("customer_email", data.customerEmail.toLowerCase())
      .in("status", ["active", "pending", "paused"])
      .maybeSingle();

    if (existingSub) {
      console.log("[create-guest-subscription] Found existing subscription:", existingSub.id);
      
      // Return existing subscription - don't error
      return new Response(
        JSON.stringify({
          success: true,
          existing: true,
          subscription: {
            ...existingSub,
            plan_name: existingSub.subscription_plans?.name || "Plan",
            washes_per_month: existingSub.subscription_plans?.washes_per_month || 0,
          },
          message: existingSub.status === "active" 
            ? "Ya tenés una suscripción activa. Podés reservar usando tus créditos."
            : "Ya tenés una suscripción pendiente. Completá el pago para activarla.",
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const siteUrl = Deno.env.get("SITE_URL") || "https://washero.online";
    const now = new Date();
    const periodEnd = new Date(now);
    periodEnd.setMonth(periodEnd.getMonth() + 1);

    const isOnlinePayment = data.paymentMethod === "mercadopago";

    console.log("[create-guest-subscription] Creating subscription, isOnlinePayment:", isOnlinePayment);

    // Step 1: Insert subscription (no user_id for guest subscriptions)
    const { data: subscription, error: subError } = await supabase
      .from("subscriptions")
      .insert({
        plan_id: data.planId,
        customer_name: data.customerName,
        customer_email: data.customerEmail.toLowerCase(),
        customer_phone: data.customerPhone,
        status: "pending",
        washes_remaining: 0, // Will be set when activated
        washes_used_in_cycle: 0,
        current_period_start: now.toISOString(),
        current_period_end: periodEnd.toISOString(),
      })
      .select()
      .single();

    if (subError) {
      console.error("[create-guest-subscription] Subscription insert error:", {
        message: subError.message,
        code: subError.code,
        details: subError.details,
        hint: subError.hint,
      });
      throw new Error(`Error al crear la suscripción: ${subError.message}`);
    }

    console.log("[create-guest-subscription] Subscription created:", subscription.id);

    // Step 2: Create initial subscription_credits for current month
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    
    const { error: creditsError } = await supabase
      .from("subscription_credits")
      .insert({
        subscription_id: subscription.id,
        month: currentMonth,
        total_credits: 0, // Will be set to plan.washes_per_month when activated
        remaining_credits: 0,
      });

    if (creditsError) {
      console.error("[create-guest-subscription] Credits insert error:", creditsError);
      // Don't fail, just log
    } else {
      console.log("[create-guest-subscription] Credits created for month:", currentMonth);
    }

    // Step 3: If online payment, send payment instructions email
    let paymentEmailSent = false;
    let paymentIntentId: string | null = null;

    if (isOnlinePayment && resendApiKey) {
      try {
        // Get payment settings
        const { data: paymentSettings } = await supabase
          .from("payment_settings")
          .select("*")
          .eq("is_enabled", true)
          .single();

        if (paymentSettings) {
          // Create payment intent for tracking
          const { data: paymentIntent } = await supabase
            .from("payment_intents")
            .insert({
              subscription_id: subscription.id,
              amount_ars: plan.price_cents,
              type: "subscription_monthly",
              status: "pending",
            })
            .select()
            .single();

          if (paymentIntent) {
            paymentIntentId = paymentIntent.id;
          }

          const paymentUrl = paymentIntent 
            ? `${siteUrl}/pagar/${paymentIntent.id}` 
            : paymentSettings.mp_payment_link;

          const paymentRef = `SUSC-${subscription.id.substring(0, 8).toUpperCase()}-${currentMonth.replace("-", "")}`;

          // Build and send email
          const emailHtml = buildSubscriptionPaymentEmail(
            data.customerName,
            plan.name,
            plan.price_cents,
            currentMonth,
            paymentRef,
            paymentSettings,
            paymentUrl
          );

          console.log("[create-guest-subscription] Sending payment email to:", data.customerEmail);

          const emailResponse = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${resendApiKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              from: resendFromEmail,
              to: [data.customerEmail.toLowerCase()],
              subject: `💳 Tu Suscripción Washero - Instrucciones de Pago`,
              html: emailHtml,
            }),
          });

          const emailData = await emailResponse.json();
          console.log("[create-guest-subscription] Resend response:", emailData);

          if (emailResponse.ok) {
            paymentEmailSent = true;
            
            // Log notification
            await supabase.from("notification_logs").insert({
              recipient: data.customerEmail.toLowerCase(),
              notification_type: "email",
              message_type: "subscription_payment",
              message_content: `Pago suscripción ${plan.name}`,
              status: "sent",
              external_id: emailData.id,
            });
          }
        }
      } catch (emailError: any) {
        console.error("[create-guest-subscription] Payment email error:", emailError);
        // Don't fail the subscription creation
      }
    }

    // Step 4: Queue admin notification (fire and forget)
    const queueUrl = `${supabaseUrl}/functions/v1/queue-notifications`;
    
    fetch(queueUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${supabaseServiceKey}`,
      },
      body: JSON.stringify({ 
        subscriptionId: subscription.id,
        eventType: "subscription_request",
        planName: plan.name,
        customerName: data.customerName,
        customerEmail: data.customerEmail,
        customerPhone: data.customerPhone,
        paymentMethod: data.paymentMethod,
      }),
    }).catch(err => console.error("[create-guest-subscription] Queue error:", err));

    // Log event
    await supabase.from("subscription_events").insert({
      subscription_id: subscription.id,
      event_type: "subscription_created",
      payload: {
        plan_name: plan.name,
        payment_method: data.paymentMethod,
        payment_email_sent: paymentEmailSent,
      },
    });

    return new Response(
      JSON.stringify({
        success: true,
        subscription: {
          ...subscription,
          plan_name: plan.name,
          washes_per_month: plan.washes_per_month,
        },
        isPending: true,
        paymentEmailSent,
        paymentIntentId,
        message: isOnlinePayment && paymentEmailSent
          ? "Suscripción creada. Te enviamos las instrucciones de pago por email."
          : "Solicitud de suscripción recibida. Te contactaremos para coordinar el pago.",
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error("[create-guest-subscription] Error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
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
      <h1>🎉 ¡Bienvenido a Washero!</h1>
      <p>Suscripción ${planName}</p>
    </div>
    <div class="content">
      <p class="greeting">Hola ${customerName},</p>
      <p>¡Gracias por elegir Washero! Tu suscripción está casi lista. Para activarla, realizá el pago por el siguiente monto:</p>
      
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
        <p>✉️ Cuando hagas el pago, <strong>respondé este email con el comprobante</strong> y activamos tu suscripción.</p>
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
