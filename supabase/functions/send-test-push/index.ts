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
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return new Response(JSON.stringify({ error: "No authorization header" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
  const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const {
    data: { user },
    error: userError,
  } = await supabaseUser.auth.getUser();

  if (userError || !user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let body: { endpoint?: string | null } = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  try {
    const vapidPublicKey = Deno.env.get("VAPID_PUBLIC_KEY");
    const vapidPrivateKey = Deno.env.get("VAPID_PRIVATE_KEY");

    if (!vapidPublicKey || !vapidPrivateKey) {
      return new Response(
        JSON.stringify({ error: "VAPID keys not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let query = supabaseAdmin
      .from("push_subscriptions")
      .select("id, endpoint, p256dh, auth")
      .eq("user_id", user.id);

    if (body.endpoint) {
      query = query.eq("endpoint", body.endpoint);
    }

    const { data: subscriptions, error: subscriptionError } = await query;

    if (subscriptionError) {
      return new Response(
        JSON.stringify({ error: `Error reading subscriptions: ${subscriptionError.message}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!subscriptions || subscriptions.length === 0) {
      return new Response(
        JSON.stringify({ error: "No push subscriptions found for this user/device" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const testId = crypto.randomUUID();
    const sentAt = new Date().toISOString();

    console.log(`[send-test-push] testId=${testId} subscriptions=${subscriptions.length} user=${user.id}`);

    const pushPayload = {
      title: "🧪 Notificación de prueba",
      body: "Push activa: vas a recibir alertas de reservas y mensajes.",
      icon: "/icons/washero-driver-192.png",
      badge: "/icons/washero-driver-192.png",
      tag: `test-push-${testId}`,
      url: "/ops?tab=notifications",
      data: {
        tab: "notifications",
        type: "test_push",
        testId,
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
          await supabaseAdmin.from("push_subscriptions").delete().eq("id", sub.id);
        }

        return {
          subscription_id: sub.id,
          endpoint: sub.endpoint,
          ...result,
        };
      })
    );

    const successful = results.filter(
      (r) => r.status === "fulfilled" && r.value.success
    );

    const failed = results
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

    const sent = successful.length;
    const total = subscriptions.length;

    console.log(`[send-test-push] testId=${testId} sent=${sent}/${total}`);
    if (failed.length > 0) {
      console.log(`[send-test-push] failures=${JSON.stringify(failed)}`);
    }

    const success = sent > 0;

    return new Response(
      JSON.stringify({
        success,
        sent,
        total,
        testId,
        failures: failed,
        error: success ? null : (failed[0] as any)?.error || "Push delivery failed",
      }),
      {
        status: success ? 200 : 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("[send-test-push] Error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
