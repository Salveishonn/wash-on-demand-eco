import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { requireAdmin } from "../_shared/adminAuth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const authResult = await requireAdmin(req);
  if ("error" in authResult) return authResult.error;

  console.log("[admin-reveal-service-key] Admin", authResult.userId, "requested Render keys");

  const payload = {
    SUPABASE_URL: Deno.env.get("SUPABASE_URL") || "",
    SUPABASE_SERVICE_ROLE_KEY: Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "",
    SUPABASE_BUCKET: "whatsapp-media",
    TRANSCODER_SHARED_SECRET: Deno.env.get("WHATSAPP_TRANSCODER_SECRET") || "",
  };

  return new Response(JSON.stringify({ success: true, ...payload }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
    status: 200,
  });
});
