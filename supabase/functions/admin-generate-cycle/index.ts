import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface GenerateCycleRequest {
  subscription_id: string;
  cycle_month?: string; // Format: YYYY-MM, defaults to current month
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const { subscription_id, cycle_month }: GenerateCycleRequest = await req.json();

    console.log("[admin-generate-cycle] Request:", { subscription_id, cycle_month });

    if (!subscription_id) {
      throw new Error("subscription_id es requerido");
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
      console.error("[admin-generate-cycle] Fetch error:", fetchError);
      throw new Error("Suscripción no encontrada");
    }

    const plan = subscription.subscription_plans;
    if (!plan) {
      throw new Error("Plan no encontrado para la suscripción");
    }

    // Determine cycle month
    const now = new Date();
    const targetMonth = cycle_month || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

    // Check if cycle already exists
    const { data: existingCycle } = await supabase
      .from("subscription_credits")
      .select("*")
      .eq("subscription_id", subscription_id)
      .eq("month", targetMonth)
      .maybeSingle();

    if (existingCycle) {
      console.log("[admin-generate-cycle] Cycle already exists for", targetMonth);
      return new Response(
        JSON.stringify({
          success: true,
          cycle: existingCycle,
          message: `Ciclo ya existente para ${targetMonth}`,
          created: false,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create new cycle
    const { data: newCycle, error: insertError } = await supabase
      .from("subscription_credits")
      .insert({
        subscription_id,
        month: targetMonth,
        total_credits: plan.washes_per_month,
        remaining_credits: plan.washes_per_month,
      })
      .select()
      .single();

    if (insertError) {
      console.error("[admin-generate-cycle] Insert error:", insertError);
      throw new Error(`Error al crear ciclo: ${insertError.message}`);
    }

    // Also update subscription's washes_remaining
    const periodEnd = new Date(now);
    periodEnd.setMonth(periodEnd.getMonth() + 1);

    await supabase
      .from("subscriptions")
      .update({
        washes_remaining: plan.washes_per_month,
        washes_used_in_cycle: 0,
        current_period_start: now.toISOString(),
        current_period_end: periodEnd.toISOString(),
      })
      .eq("id", subscription_id);

    console.log("[admin-generate-cycle] Created cycle for", targetMonth);

    // Log event
    await supabase.from("subscription_events").insert({
      subscription_id,
      event_type: "cycle_generated",
      payload: {
        cycle_month: targetMonth,
        credits: plan.washes_per_month,
      },
    });

    return new Response(
      JSON.stringify({
        success: true,
        cycle: newCycle,
        message: `Nuevo ciclo generado para ${targetMonth} con ${plan.washes_per_month} créditos`,
        created: true,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("[admin-generate-cycle] Error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
