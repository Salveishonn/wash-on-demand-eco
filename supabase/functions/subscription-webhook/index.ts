import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  console.log("[subscription-webhook] ====== WEBHOOK RECEIVED ======");
  console.log("[subscription-webhook] Method:", req.method);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const mercadoPagoToken = Deno.env.get("MERCADOPAGO_ACCESS_TOKEN")!;

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    let body: any;
    const contentType = req.headers.get("content-type") || "";
    
    if (contentType.includes("application/json")) {
      body = await req.json();
    } else {
      const bodyText = await req.text();
      const params = new URLSearchParams(bodyText);
      body = Object.fromEntries(params.entries());
    }
    
    console.log("[subscription-webhook] Body:", JSON.stringify(body, null, 2));

    // Log webhook
    await supabase.from("webhook_logs").insert({
      source: "mercadopago_subscription",
      event_type: body.type || body.action,
      payload: body,
      signature_valid: true,
      processed: false,
    });

    const topic = body.type || body.topic;
    const dataId = body.data?.id || body.id;

    // Handle subscription events
    if (topic === "subscription_preapproval" || topic === "preapproval") {
      console.log("[subscription-webhook] Processing subscription event:", dataId);

      // Fetch preapproval details
      const preapprovalResponse = await fetch(
        `https://api.mercadopago.com/preapproval/${dataId}`,
        {
          headers: { "Authorization": `Bearer ${mercadoPagoToken}` },
        }
      );

      if (!preapprovalResponse.ok) {
        console.error("[subscription-webhook] Preapproval fetch error");
        return new Response("OK", { status: 200 });
      }

      const preapproval = await preapprovalResponse.json();
      console.log("[subscription-webhook] Preapproval:", JSON.stringify(preapproval, null, 2));

      // Find subscription by MP ID
      const { data: subscription, error: fetchError } = await supabase
        .from("subscriptions")
        .select("*")
        .eq("mercadopago_subscription_id", dataId)
        .maybeSingle();

      if (fetchError || !subscription) {
        console.log("[subscription-webhook] Subscription not found for MP ID:", dataId);
        return new Response("OK", { status: 200 });
      }

      // Map status
      let newStatus: 'active' | 'paused' | 'cancelled' | 'payment_failed';
      
      switch (preapproval.status) {
        case "authorized":
        case "approved":
          newStatus = "active";
          break;
        case "paused":
          newStatus = "paused";
          break;
        case "cancelled":
          newStatus = "cancelled";
          break;
        case "pending":
        default:
          // Keep current status
          newStatus = subscription.status;
      }

      console.log("[subscription-webhook] Updating subscription status:", newStatus);

      // Update subscription
      await supabase
        .from("subscriptions")
        .update({ status: newStatus })
        .eq("id", subscription.id);

      // Log event
      await supabase.from("subscription_events").insert({
        subscription_id: subscription.id,
        event_type: `preapproval_${preapproval.status}`,
        payload: preapproval,
        processed: true,
      });
    }

    // Handle subscription payment events
    if (topic === "subscription_authorized_payment") {
      console.log("[subscription-webhook] Subscription payment received:", dataId);

      // Fetch payment details
      const paymentResponse = await fetch(
        `https://api.mercadopago.com/v1/authorized_payments/${dataId}`,
        {
          headers: { "Authorization": `Bearer ${mercadoPagoToken}` },
        }
      );

      if (paymentResponse.ok) {
        const payment = await paymentResponse.json();
        console.log("[subscription-webhook] Payment:", JSON.stringify(payment, null, 2));

        const preapprovalId = payment.preapproval_id;

        if (preapprovalId) {
          const { data: subscription } = await supabase
            .from("subscriptions")
            .select("*, subscription_plans(*)")
            .eq("mercadopago_subscription_id", preapprovalId)
            .maybeSingle();

          if (subscription && payment.status === "approved") {
            // Renew washes for the new period
            const washesPerMonth = subscription.subscription_plans?.washes_per_month || 0;
            
            const now = new Date();
            const periodEnd = new Date(now);
            periodEnd.setMonth(periodEnd.getMonth() + 1);

            await supabase
              .from("subscriptions")
              .update({
                status: "active",
                washes_remaining: washesPerMonth,
                washes_used_in_cycle: 0,
                current_period_start: now.toISOString(),
                current_period_end: periodEnd.toISOString(),
              })
              .eq("id", subscription.id);

            console.log("[subscription-webhook] Subscription renewed:", subscription.id);

            // Log event
            await supabase.from("subscription_events").insert({
              subscription_id: subscription.id,
              event_type: "payment_approved",
              payload: payment,
              processed: true,
            });
          } else if (subscription && payment.status === "rejected") {
            await supabase
              .from("subscriptions")
              .update({ status: "payment_failed" })
              .eq("id", subscription.id);

            await supabase.from("subscription_events").insert({
              subscription_id: subscription.id,
              event_type: "payment_failed",
              payload: payment,
              processed: true,
            });
          }
        }
      }
    }

    // Mark webhook as processed
    await supabase
      .from("webhook_logs")
      .update({ processed: true })
      .eq("source", "mercadopago_subscription");

    return new Response("OK", { status: 200, headers: corsHeaders });

  } catch (error: any) {
    console.error("[subscription-webhook] Error:", error);
    return new Response("OK", { status: 200 });
  }
});
