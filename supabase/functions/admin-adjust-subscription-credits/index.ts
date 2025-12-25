import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface AdjustCreditsRequest {
  subscription_id: string;
  delta: number; // +1, -1, etc
  reason?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const { subscription_id, delta, reason }: AdjustCreditsRequest = await req.json();

    console.log("[admin-adjust-subscription-credits] Request:", { subscription_id, delta, reason });

    if (!subscription_id) {
      throw new Error("subscription_id es requerido");
    }

    if (typeof delta !== "number" || delta === 0) {
      throw new Error("delta debe ser un número distinto de 0");
    }

    // Get current subscription
    const { data: subscription, error: fetchError } = await supabase
      .from("subscriptions")
      .select("*")
      .eq("id", subscription_id)
      .single();

    if (fetchError || !subscription) {
      console.error("[admin-adjust-subscription-credits] Fetch error:", fetchError);
      throw new Error("Suscripción no encontrada");
    }

    const oldCredits = subscription.washes_remaining;
    const newCredits = Math.max(0, oldCredits + delta); // Prevent negative credits

    // Update subscription
    const { data: updated, error: updateError } = await supabase
      .from("subscriptions")
      .update({ washes_remaining: newCredits })
      .eq("id", subscription_id)
      .select()
      .single();

    if (updateError) {
      console.error("[admin-adjust-subscription-credits] Update error:", updateError);
      throw new Error(`Error al actualizar: ${updateError.message}`);
    }

    console.log("[admin-adjust-subscription-credits] Credits updated:", { old: oldCredits, new: newCredits });

    // Log event
    await supabase.from("subscription_events").insert({
      subscription_id,
      event_type: "credits_adjusted",
      payload: {
        old_credits: oldCredits,
        new_credits: newCredits,
        delta,
        reason: reason || "Ajuste manual por admin",
      },
    });

    return new Response(
      JSON.stringify({
        success: true,
        subscription: updated,
        old_credits: oldCredits,
        new_credits: newCredits,
        message: `Créditos ajustados: ${oldCredits} → ${newCredits}`,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("[admin-adjust-subscription-credits] Error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
