// Admin-only: returns capability flags for the Mensajes panel.
// Does NOT return secrets — only booleans + safe URL templates.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "");
  if (!token) return jsonResponse({ ok: false, error: "missing_authorization" }, 401);

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
  let userId: string | null = null;
  try {
    const parts = token.split(".");
    if (parts.length === 3) {
      const p = JSON.parse(atob(parts[1].replace(/-/g, "+").replace(/_/g, "/")));
      if (p?.exp && p.exp * 1000 > Date.now()) userId = p.sub ?? null;
    }
  } catch (_e) { /* fall through */ }
  if (!userId) {
    const { data: u } = await supabase.auth.getUser(token);
    userId = u?.user?.id ?? null;
  }
  if (!userId) return jsonResponse({ ok: false, error: "invalid_jwt" }, 401);

  const { data: roleRow } = await supabase
    .from("user_roles").select("role").eq("user_id", userId).eq("role", "admin").maybeSingle();
  if (!roleRow) return jsonResponse({ ok: false, error: "forbidden" }, 403);

  const apiToken = Deno.env.get("BOTMAKER_API_TOKEN") ?? "";
  const baseUrl = Deno.env.get("BOTMAKER_BASE_URL") ?? "";
  const channelId = Deno.env.get("BOTMAKER_CHANNEL_ID") ?? "";
  return jsonResponse({
    ok: true,
    canSendFromAdmin: Boolean(apiToken && baseUrl),
    hasChannelId: Boolean(channelId),
  });
});
