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

  // Verify authenticated user (admin)
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

  // Get the user
  const { data: { user }, error: userError } = await supabaseUser.auth.getUser();
  if (userError || !user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
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

    // Get this user's push subscriptions
    const { data: subscriptions } = await supabaseAdmin
      .from("push_subscriptions")
      .select("*")
      .eq("user_id", user.id);

    if (!subscriptions || subscriptions.length === 0) {
      return new Response(
        JSON.stringify({ error: "No push subscriptions found for this user" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[send-test-push] Sending test to ${subscriptions.length} devices for user ${user.id}`);

    const pushPayload = {
      title: "🧪 Notificación de prueba",
      body: "¡Las notificaciones push de Washero Driver están funcionando!",
      icon: "/icons/washero-driver-192.png",
      badge: "/icons/washero-driver-192.png",
      tag: "test-push",
      url: "/ops",
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
        
        return result;
      })
    );

    const sent = results.filter(
      (r) => r.status === "fulfilled" && r.value.success
    ).length;

    console.log(`[send-test-push] Results: ${sent}/${subscriptions.length} sent`);

    // Log details for debugging
    results.forEach((r, i) => {
      if (r.status === "fulfilled") {
        console.log(`[send-test-push] Sub ${i}: success=${r.value.success} status=${r.value.status} error=${r.value.error || 'none'}`);
      } else {
        console.log(`[send-test-push] Sub ${i}: rejected: ${r.reason}`);
      }
    });

    return new Response(
      JSON.stringify({ success: true, sent, total: subscriptions.length }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("[send-test-push] Error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
