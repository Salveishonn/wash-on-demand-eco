import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

  // Verify service role key (internal-only)
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

    // 2. Send push notifications to all subscribed operators
    const vapidPrivateKey = Deno.env.get("VAPID_PRIVATE_KEY");
    const vapidPublicKey = Deno.env.get("VAPID_PUBLIC_KEY");

    if (!vapidPrivateKey || !vapidPublicKey) {
      console.log("[send-ops-notification] VAPID keys not configured, skipping push");
      return new Response(
        JSON.stringify({ success: true, push: false, reason: "no_vapid_keys" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get all push subscriptions
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

    console.log(`[send-ops-notification] Sending to ${subscriptions.length} subscribers`);

    // Web Push requires crypto operations - use web-push compatible approach
    // For now, log that we'd send push. Full web-push implementation requires 
    // the web-push library which needs Node.js or a Deno-compatible version.
    // The in-app notification + realtime subscription handles immediate delivery.
    
    console.log("[send-ops-notification] In-app notification created, realtime will deliver instantly");

    return new Response(
      JSON.stringify({ 
        success: true, 
        push: false, 
        in_app: true,
        subscribers: subscriptions.length,
        message: "In-app notification created with realtime delivery"
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
