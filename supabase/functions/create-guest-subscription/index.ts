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

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const mercadoPagoToken = Deno.env.get("MERCADOPAGO_ACCESS_TOKEN");

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

    // Check for existing active subscription
    const { data: existingSub } = await supabase
      .from("subscriptions")
      .select("id, status")
      .eq("customer_email", data.customerEmail.toLowerCase())
      .eq("customer_phone", data.customerPhone)
      .eq("status", "active")
      .maybeSingle();

    if (existingSub) {
      throw new Error("Ya tenés una suscripción activa con este email y teléfono");
    }

    const siteUrl = Deno.env.get("SITE_URL") || "https://pkndizbozytnpgqxymms.lovable.app";
    const now = new Date();
    const periodEnd = new Date(now);
    periodEnd.setMonth(periodEnd.getMonth() + 1);

    // Pay Later flow
    if (data.paymentMethod === "pay_later" || !mercadoPagoToken) {
      console.log("[create-guest-subscription] Creating pending subscription (pay later)");

      const { data: subscription, error: subError } = await supabase
        .from("subscriptions")
        .insert({
          plan_id: data.planId,
          user_id: "00000000-0000-0000-0000-000000000000", // Placeholder for guest
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
        console.error("[create-guest-subscription] Insert error:", subError);
        throw new Error("Error al crear la suscripción");
      }

      console.log("[create-guest-subscription] Subscription created:", subscription.id);

      // Queue notification to admin
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
        }),
      }).catch(err => console.error("[create-guest-subscription] Queue error:", err));

      return new Response(
        JSON.stringify({
          success: true,
          subscription,
          isPending: true,
          message: "Solicitud de suscripción recibida. Te contactaremos para coordinar el pago.",
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // MercadoPago flow
    console.log("[create-guest-subscription] Creating MercadoPago subscription");

    const preapprovalData = {
      reason: `Suscripción Washero ${plan.name}`,
      auto_recurring: {
        frequency: 1,
        frequency_type: "months",
        transaction_amount: plan.price_cents / 100,
        currency_id: "ARS",
      },
      payer_email: data.customerEmail,
      back_url: `${siteUrl}/suscripcion-confirmada?status=active&plan=${encodeURIComponent(plan.name)}`,
      external_reference: `${data.customerEmail}|${data.customerPhone}`,
    };

    console.log("[create-guest-subscription] MercadoPago preapproval:", JSON.stringify(preapprovalData, null, 2));

    const mpResponse = await fetch("https://api.mercadopago.com/preapproval", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${mercadoPagoToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(preapprovalData),
    });

    const mpData = await mpResponse.json();

    if (!mpResponse.ok) {
      console.error("[create-guest-subscription] MercadoPago error:", mpData);
      throw new Error(mpData.message || "Error al crear suscripción en MercadoPago");
    }

    console.log("[create-guest-subscription] MercadoPago preapproval created:", mpData.id);

    // Create subscription (pending until MercadoPago confirms)
    const { data: subscription, error: subError } = await supabase
      .from("subscriptions")
      .insert({
        plan_id: data.planId,
        user_id: "00000000-0000-0000-0000-000000000000",
        customer_name: data.customerName,
        customer_email: data.customerEmail.toLowerCase(),
        customer_phone: data.customerPhone,
        status: "pending",
        mercadopago_subscription_id: mpData.id,
        washes_remaining: 0,
        washes_used_in_cycle: 0,
        current_period_start: now.toISOString(),
        current_period_end: periodEnd.toISOString(),
      })
      .select()
      .single();

    if (subError) {
      console.error("[create-guest-subscription] Insert error:", subError);
      throw new Error("Error al crear la suscripción");
    }

    console.log("[create-guest-subscription] Subscription created:", subscription.id);

    return new Response(
      JSON.stringify({
        success: true,
        subscription,
        initPoint: mpData.init_point,
        sandboxInitPoint: mpData.sandbox_init_point,
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