import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Canonical subscription status values
const VALID_STATUSES = ["pending", "active", "paused", "cancelled", "payment_failed"];

interface SetStatusRequest {
  subscription_id: string;
  status: string;
  reset_credits?: boolean; // If true and activating, reset credits to plan amount
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const { subscription_id, status, reset_credits }: SetStatusRequest = await req.json();

    console.log("[admin-set-subscription-status] Request:", { subscription_id, status, reset_credits });

    // Validate status
    if (!VALID_STATUSES.includes(status)) {
      throw new Error(`Estado inválido: ${status}. Debe ser uno de: ${VALID_STATUSES.join(", ")}`);
    }

    if (!subscription_id) {
      throw new Error("subscription_id es requerido");
    }

    // Get current subscription with plan info
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
      console.error("[admin-set-subscription-status] Fetch error:", fetchError);
      throw new Error("Suscripción no encontrada");
    }

    const oldStatus = subscription.status;
    const plan = subscription.subscription_plans;

    // Build update object
    const updateData: Record<string, any> = { status };

    // If activating and reset_credits is true (or coming from pending), set credits
    if (status === "active" && (reset_credits || oldStatus === "pending") && plan) {
      updateData.washes_remaining = plan.washes_per_month;
      updateData.washes_used_in_cycle = 0;
      
      const now = new Date();
      const periodEnd = new Date(now);
      periodEnd.setMonth(periodEnd.getMonth() + 1);
      updateData.current_period_start = now.toISOString();
      updateData.current_period_end = periodEnd.toISOString();
    }

    // Update subscription
    const { data: updated, error: updateError } = await supabase
      .from("subscriptions")
      .update(updateData)
      .eq("id", subscription_id)
      .select()
      .single();

    if (updateError) {
      console.error("[admin-set-subscription-status] Update error:", updateError);
      throw new Error(`Error al actualizar: ${updateError.message}`);
    }

    console.log("[admin-set-subscription-status] Updated:", { old: oldStatus, new: status });

    // Log event
    await supabase.from("subscription_events").insert({
      subscription_id,
      event_type: "status_change",
      payload: {
        old_status: oldStatus,
        new_status: status,
        reset_credits: reset_credits || false,
      },
    });

    // Emit webhook event based on status change
    const notifyEventUrl = `${supabaseUrl}/functions/v1/notify-event`;
    
    // Determine event type
    let eventType: string | null = null;
    if (status === "active" && oldStatus === "pending") {
      eventType = "subscription.approved";
    } else if (status === "cancelled" && oldStatus === "pending") {
      eventType = "subscription.declined";
    }
    
    if (eventType) {
      fetch(notifyEventUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${supabaseServiceKey}`,
        },
        body: JSON.stringify({
          event: eventType,
          timestamp: new Date().toISOString(),
          user_id: subscription.user_id,
          customer_email: subscription.customer_email,
          customer_phone: subscription.customer_phone,
          customer_name: subscription.customer_name,
          subscription_id,
          status,
          metadata: { 
            plan_name: plan?.name,
            plan_code: subscription.plan_code
          },
        }),
      }).catch(err => console.error("[admin-set-subscription-status] Notify event error:", err));
    }

    return new Response(
      JSON.stringify({
        success: true,
        subscription: updated,
        message: `Estado actualizado de ${oldStatus} a ${status}`,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("[admin-set-subscription-status] Error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
