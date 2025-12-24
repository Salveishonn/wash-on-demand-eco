import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface CreateSubscriptionRequest {
  planId: string;
  customerEmail: string;
  customerName: string;
  customerPhone: string;
}

serve(async (req) => {
  console.log("[create-subscription] ====== FUNCTION INVOKED ======");
  
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const mercadoPagoToken = Deno.env.get("MERCADOPAGO_ACCESS_TOKEN");
  const mpEnv = Deno.env.get("MERCADOPAGO_ENV") || "sandbox";

  console.log("[create-subscription] Environment:", mpEnv);
  console.log("[create-subscription] MP Token set:", !!mercadoPagoToken);

  if (!mercadoPagoToken) {
    return new Response(
      JSON.stringify({ error: "MercadoPago no configurado" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const data: CreateSubscriptionRequest = await req.json();
    
    console.log("[create-subscription] Request data:", JSON.stringify(data, null, 2));

    // Get plan details
    const { data: plan, error: planError } = await supabase
      .from("subscription_plans")
      .select("*")
      .eq("id", data.planId)
      .single();

    if (planError || !plan) {
      console.error("[create-subscription] Plan error:", planError);
      throw new Error("Plan no encontrado");
    }

    console.log("[create-subscription] Plan found:", plan.name, "- Price:", plan.price_cents, "cents");

    // Production site URL
    const siteUrl = "https://washero.online";
    const webhookUrl = `${supabaseUrl}/functions/v1/subscription-webhook`;

    // Convert cents to ARS
    const amountARS = plan.price_cents / 100;

    // Generate a unique user ID for this subscription (since we don't have auth)
    const guestUserId = crypto.randomUUID();

    console.log("[create-subscription] Guest user ID:", guestUserId);
    console.log("[create-subscription] Amount ARS:", amountARS);

    // Create MercadoPago preapproval (subscription)
    const preapprovalData = {
      reason: `Suscripción Washero ${plan.name}`,
      auto_recurring: {
        frequency: 1,
        frequency_type: "months",
        transaction_amount: amountARS,
        currency_id: "ARS",
      },
      payer_email: data.customerEmail,
      back_url: `${siteUrl}/suscripcion-confirmada?plan=${plan.name}`,
      external_reference: guestUserId,
      notification_url: webhookUrl,
    };

    console.log("[create-subscription] Creating MercadoPago preapproval:", JSON.stringify(preapprovalData, null, 2));

    const mpResponse = await fetch("https://api.mercadopago.com/preapproval", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${mercadoPagoToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(preapprovalData),
    });

    const mpData = await mpResponse.json();

    console.log("[create-subscription] MP Response status:", mpResponse.status);
    console.log("[create-subscription] MP Response:", JSON.stringify(mpData, null, 2));

    if (!mpResponse.ok) {
      console.error("[create-subscription] MercadoPago error:", mpData);
      throw new Error(mpData.message || "Error al crear suscripción en MercadoPago");
    }

    console.log("[create-subscription] MercadoPago preapproval created:", mpData.id);

    // Calculate period dates
    const now = new Date();
    const periodEnd = new Date(now);
    periodEnd.setMonth(periodEnd.getMonth() + 1);

    // Create subscription in database
    const { data: subscription, error: subError } = await supabase
      .from("subscriptions")
      .insert({
        user_id: guestUserId,
        plan_id: data.planId,
        status: "active", // Will be updated by webhook if payment fails
        mercadopago_subscription_id: mpData.id,
        washes_remaining: plan.washes_per_month,
        washes_used_in_cycle: 0,
        current_period_start: now.toISOString(),
        current_period_end: periodEnd.toISOString(),
        customer_email: data.customerEmail,
        customer_name: data.customerName,
        customer_phone: data.customerPhone,
      })
      .select()
      .single();

    if (subError) {
      console.error("[create-subscription] Error creating subscription:", subError);
      throw new Error("Error al guardar la suscripción");
    }

    console.log("[create-subscription] Subscription created:", subscription.id);

    // Return the appropriate init_point based on environment
    const initPoint = mpEnv === "production" ? mpData.init_point : mpData.sandbox_init_point;
    
    console.log("[create-subscription] Init point:", initPoint);

    return new Response(
      JSON.stringify({
        success: true,
        subscription,
        initPoint: initPoint || mpData.init_point,
        sandboxInitPoint: mpData.sandbox_init_point,
        environment: mpEnv,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error("[create-subscription] Error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
