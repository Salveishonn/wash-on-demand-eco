import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendWebPush } from "../_shared/webPushCrypto.ts";
import type { PushSubscription } from "../_shared/webPushCrypto.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function resolveNotificationTab(eventType?: string): "notifications" | "messages" | "calendar" {
  if (!eventType) return "notifications";
  if (eventType.includes("whatsapp") || eventType.includes("message")) return "messages";
  if (eventType.includes("booking")) return "calendar";
  return "notifications";
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

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

    const eventType = event_type || "washero_ops";
    const tab = resolveNotificationTab(eventType);
    const sentAt = new Date().toISOString();

    const { error: insertError } = await supabase
      .from("operator_notifications")
      .insert({
        event_type: eventType,
        title,
        body,
        data: data || {},
        user_id: user_id || null,
        read: false,
      });

    if (insertError) {
      console.error("[send-ops-notification] Insert error:", insertError);
    }

    const vapidPublicKey = Deno.env.get("VAPID_PUBLIC_KEY");
    const vapidPrivateKey = Deno.env.get("VAPID_PRIVATE_KEY");

    if (!vapidPublicKey || !vapidPrivateKey) {
      console.log("[send-ops-notification] VAPID keys not configured, skipping push");
      return new Response(
        JSON.stringify({ success: true, push: false, reason: "no_vapid_keys" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let query = supabase.from("push_subscriptions").select("id, endpoint, p256dh, auth");
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
      tag: eventType,
      url: data?.url || `/ops?tab=${tab}`,
      data: {
        ...(data || {}),
        tab,
        event_type: eventType,
        sentAt,
      },
    };

    const results = await Promise.allSettled(
      subscriptions.map(async (sub: any) => {
        const pushSub: PushSubscription = {
          endpoint: sub.endpoint,
          p256dh: sub.p256dh,
          auth: sub.auth,
        };

        const result = await sendWebPush(pushSub, pushPayload, vapidPublicKey, vapidPrivateKey);

        if (result.status === 410 || result.status === 404) {
          console.log("[send-ops-notification] Removing expired subscription:", sub.endpoint.slice(0, 50));
          await supabase.from("push_subscriptions").delete().eq("id", sub.id);
        }

        return { ...result, endpoint: sub.endpoint, subscription_id: sub.id };
      })
    );

    const sent = results.filter(
      (r) => r.status === "fulfilled" && r.value.success
    ).length;
    const failed = results.length - sent;

    const failures = results
      .map((r) => {
        if (r.status === "fulfilled" && !r.value.success) {
          return { status: r.value.status, error: r.value.error };
        }
        if (r.status === "rejected") {
          return { error: String(r.reason) };
        }
        return null;
      })
      .filter(Boolean);

    console.log(`[send-ops-notification] Push results: ${sent} sent, ${failed} failed`);
    if (failures.length > 0) {
      console.log(`[send-ops-notification] Failure details: ${JSON.stringify(failures)}`);
    }

    return new Response(
      JSON.stringify({
        success: true,
        push: true,
        sent,
        failed,
        total: subscriptions.length,
        all_failed: sent === 0 && failed > 0,
        failures,
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
