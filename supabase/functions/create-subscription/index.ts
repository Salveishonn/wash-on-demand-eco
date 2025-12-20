import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface CreateSubscriptionRequest {
  planId: string;
  userId: string;
  customerEmail: string;
  customerName: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const mercadoPagoToken = Deno.env.get("MERCADOPAGO_ACCESS_TOKEN");

  if (!mercadoPagoToken) {
    return new Response(
      JSON.stringify({ error: "MercadoPago no configurado" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const data: CreateSubscriptionRequest = await req.json();
    
    console.log("[create-subscription] Creating subscription for user:", data.userId);

    // Get plan details
    const { data: plan, error: planError } = await supabase
      .from("subscription_plans")
      .select("*")
      .eq("id", data.planId)
      .single();

    if (planError || !plan) {
      throw new Error("Plan no encontrado");
    }

    console.log("[create-subscription] Plan found:", plan.name);

    const siteUrl = Deno.env.get("SITE_URL") || "https://pkndizbozytnpgqxymms.lovable.app";

    // Create MercadoPago preapproval (subscription)
    const preapprovalData = {
      reason: `Suscripción Washero ${plan.name}`,
      auto_recurring: {
        frequency: 1,
        frequency_type: "months",
        transaction_amount: plan.price_cents / 100,
        currency_id: "ARS",
      },
      payer_email: data.customerEmail,
      back_url: `${siteUrl}/mi-cuenta?subscription=success`,
      external_reference: data.userId,
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

    if (!mpResponse.ok) {
      console.error("[create-subscription] MercadoPago error:", mpData);
      throw new Error(mpData.message || "Error al crear suscripción en MercadoPago");
    }

    console.log("[create-subscription] MercadoPago preapproval created:", mpData.id);

    // Calculate period dates
    const now = new Date();
    const periodEnd = new Date(now);
    periodEnd.setMonth(periodEnd.getMonth() + 1);

    // Create subscription in database (status pending until payment confirmed)
    const { data: subscription, error: subError } = await supabase
      .from("subscriptions")
      .insert({
        user_id: data.userId,
        plan_id: data.planId,
        status: "active", // Will be updated by webhook
        mercadopago_subscription_id: mpData.id,
        washes_remaining: plan.washes_per_month,
        current_period_start: now.toISOString(),
        current_period_end: periodEnd.toISOString(),
      })
      .select()
      .single();

    if (subError) {
      console.error("[create-subscription] Error creating subscription:", subError);
      throw new Error("Error al guardar la suscripción");
    }

    console.log("[create-subscription] Subscription created:", subscription.id);

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
    console.error("[create-subscription] Error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
