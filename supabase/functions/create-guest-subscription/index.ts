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

    // Pay Later flow (always use this since we're not using MP API)
    console.log("[create-guest-subscription] Creating pending subscription (pay later)");

    // Step 1: Insert subscription
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
    
    const { data: credits, error: creditsError } = await supabase
      .from("subscription_credits")
      .insert({
        subscription_id: subscription.id,
        month: currentMonth,
        total_credits: 0, // Will be set to plan.washes_per_month when activated
        remaining_credits: 0,
      })
      .select()
      .single();

    if (creditsError) {
      console.error("[create-guest-subscription] Credits insert error:", {
        message: creditsError.message,
        code: creditsError.code,
        details: creditsError.details,
      });
      // Don't fail the whole request, just log the error
      console.log("[create-guest-subscription] Continuing without initial credits row");
    } else {
      console.log("[create-guest-subscription] Credits created for month:", currentMonth);
    }

    // Step 3: Queue notification to admin (fire and forget)
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
        subscription: {
          ...subscription,
          plan_name: plan.name,
          washes_per_month: plan.washes_per_month,
        },
        credits: credits || null,
        isPending: true,
        message: "Solicitud de suscripción recibida. Te contactaremos para coordinar el pago.",
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