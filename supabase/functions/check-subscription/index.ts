import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface CheckSubscriptionRequest {
  customerEmail: string;
  customerPhone: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const { customerEmail, customerPhone }: CheckSubscriptionRequest = await req.json();
    
    console.log("[check-subscription] Looking up subscription for:", customerEmail, customerPhone);

    if (!customerEmail || !customerPhone) {
      return new Response(
        JSON.stringify({ hasActiveSubscription: false }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Find active subscription by email and phone
    const { data: subscription, error } = await supabase
      .from("subscriptions")
      .select(`
        id,
        status,
        washes_remaining,
        washes_used_in_cycle,
        current_period_start,
        current_period_end,
        subscription_plans (
          id,
          name,
          washes_per_month
        )
      `)
      .eq("customer_email", customerEmail.toLowerCase())
      .eq("customer_phone", customerPhone)
      .eq("status", "active")
      .maybeSingle();

    if (error) {
      console.error("[check-subscription] Error:", error);
      throw error;
    }

    if (!subscription) {
      console.log("[check-subscription] No active subscription found");
      return new Response(
        JSON.stringify({ 
          hasActiveSubscription: false,
          message: "No tenés una suscripción activa"
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const plan = subscription.subscription_plans as any;
    const washesPerMonth = plan?.washes_per_month || 0;
    const washesRemaining = subscription.washes_remaining;
    const washesUsed = subscription.washes_used_in_cycle;

    console.log("[check-subscription] Found subscription:", {
      id: subscription.id,
      plan: plan?.name,
      washesRemaining,
      washesUsed,
      washesPerMonth,
    });

    // Check if quota is available
    const hasQuota = washesRemaining > 0;

    return new Response(
      JSON.stringify({
        hasActiveSubscription: true,
        hasQuota,
        subscription: {
          id: subscription.id,
          planName: plan?.name,
          washesPerMonth,
          washesRemaining,
          washesUsed,
          periodStart: subscription.current_period_start,
          periodEnd: subscription.current_period_end,
        },
        message: hasQuota 
          ? `Te quedan ${washesRemaining} lavado${washesRemaining > 1 ? 's' : ''} este mes`
          : "No te quedan lavados disponibles este mes",
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error("[check-subscription] Error:", error);
    return new Response(
      JSON.stringify({ 
        hasActiveSubscription: false,
        error: error.message 
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});