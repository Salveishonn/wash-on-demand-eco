import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendWebPush } from "../_shared/webPushCrypto.ts";
import type { PushSubscription } from "../_shared/webPushCrypto.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  // Only internal callers (service role)
  const authHeader = req.headers.get("Authorization");
  if (!authHeader || authHeader !== `Bearer ${supabaseServiceKey}`) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const { event_type, title, body, data, user_id } = await req.json();

    console.log("[send-ops-notification] Event:", event_type, "Title:", title);

    // 1. Insert into operator_notifications
    const { error: insertError } = await supabase
      .from("operator_notifications")
      .insert({
        event_type,
        title,
        body,
        data: data || {},
        user_id: user_id || null,
        read: false,
      });

    if (insertError) {
      console.error("[send-ops-notification] Insert error:", insertError);
    }

    // 2. Send real push notifications
    const vapidPublicKey = Deno.env.get("VAPID_PUBLIC_KEY");
    const vapidPrivateKey = Deno.env.get("VAPID_PRIVATE_KEY");

    if (!vapidPublicKey || !vapidPrivateKey) {
      console.log("[send-ops-notification] VAPID keys not configured, skipping push");
      return new Response(
        JSON.stringify({ success: true, push: false, reason: "no_vapid_keys" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get push subscriptions
    let query = supabase.from("push_subscriptions").select("*");
    if (user_id) {
      query = query.eq("user_id", user_id);
    }
    const { data: subscriptions } = await query;

    if (!subscriptions || subscriptions.length === 0) {
      console.log("[send-ops-notification] No push subscriptions found");
      return new Response(
        JSON.stringify({ success: true, push: false, reason: "no_subscriptions" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[send-ops-notification] Sending push to ${subscriptions.length} subscribers`);

    const pushPayload = {
      title: title || "Washero Driver",
      body: body || "Nueva notificación",
      icon: "/icons/washero-driver-192.png",
      badge: "/icons/washero-driver-192.png",
      tag: event_type || "washero-ops",
      url: data?.url || "/ops",
      data: data || {},
    };

    const results = await Promise.allSettled(
      subscriptions.map(async (sub: any) => {
        const pushSub: PushSubscription = {
          endpoint: sub.endpoint,
          p256dh: sub.p256dh,
          auth: sub.auth,
        };
        const result = await sendWebPush(pushSub, pushPayload, vapidPublicKey, vapidPrivateKey);
        
        // If subscription is expired/invalid (410 Gone), remove it
        if (result.status === 410 || result.status === 404) {
          console.log("[send-ops-notification] Removing expired subscription:", sub.endpoint.slice(0, 50));
          await supabase.from("push_subscriptions").delete().eq("id", sub.id);
        }
        
        return result;
      })
    );

    const sent = results.filter(
      (r) => r.status === "fulfilled" && r.value.success
    ).length;
    const failed = results.length - sent;

    console.log(`[send-ops-notification] Push results: ${sent} sent, ${failed} failed`);
    
    // Log failures for debugging
    results.forEach((r) => {
      if (r.status === "fulfilled" && !r.value.success) {
        console.log(`[send-ops-notification] Push failed: ${r.value.status} ${r.value.error}`);
      } else if (r.status === "rejected") {
        console.log(`[send-ops-notification] Push rejected: ${r.reason}`);
      }
    });

    return new Response(
      JSON.stringify({
        success: true,
        push: true,
        sent,
        failed,
        total: subscriptions.length,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("[send-ops-notification] Error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
