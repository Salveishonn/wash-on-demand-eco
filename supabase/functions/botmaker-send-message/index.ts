// Admin-only: send a text reply through Botmaker API and log it.
// Requires BOTMAKER_API_TOKEN + BOTMAKER_BASE_URL secrets.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ ok: false, error: "method_not_allowed" }, 405);

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

  const apiToken = Deno.env.get("BOTMAKER_API_TOKEN");
  const baseUrl = Deno.env.get("BOTMAKER_BASE_URL");
  if (!apiToken || !baseUrl) return jsonResponse({ ok: false, error: "botmaker_not_configured" }, 400);

  let body: any = {};
  try { body = await req.json(); } catch { return jsonResponse({ ok: false, error: "invalid_json" }, 400); }
  const conversationId: string | undefined = body?.conversation_id;
  const customerPhone: string | undefined = body?.customer_phone;
  const text: string | undefined = body?.text;
  if (!text || (!conversationId && !customerPhone)) {
    return jsonResponse({ ok: false, error: "missing_fields" }, 400);
  }

  // Botmaker send endpoint pattern (see Botmaker docs). We POST a generic message.
  const url = `${baseUrl.replace(/\/$/, "")}/v2.0/messages`;
  let providerResponse: any = null;
  let providerOk = false;
  try {
    const r = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "access-token": apiToken,
      },
      body: JSON.stringify({
        chatPlatform: "whatsapp",
        chatChannelNumber: Deno.env.get("BOTMAKER_CHANNEL_ID") ?? "",
        platformContactId: customerPhone ?? conversationId,
        message: text,
      }),
    });
    providerResponse = await r.json().catch(() => ({}));
    providerOk = r.ok;
  } catch (e) {
    providerResponse = { error: String(e) };
  }

  // Log to botmaker_messages so it shows up in the conversation
  if (conversationId) {
    await supabase.from("botmaker_messages").insert({
      conversation_id: conversationId,
      direction: "out",
      sender: "admin",
      body: text,
      raw: { provider_response: providerResponse, sent_by: userId },
    });
    await supabase.from("botmaker_conversations").update({
      last_message_at: new Date().toISOString(),
      last_message_preview: text.slice(0, 140),
      last_direction: "out",
      updated_at: new Date().toISOString(),
    }).eq("conversation_id", conversationId);
  }

  await supabase.from("communication_logs").insert({
    provider: "botmaker",
    event_type: "outbound_text",
    customer_phone: customerPhone ?? null,
    payload: { text, conversation_id: conversationId },
    provider_response: providerResponse,
    status: providerOk ? "sent" : "error",
    error: providerOk ? null : "provider_error",
  });

  return jsonResponse({ ok: providerOk, provider_response: providerResponse });
});
