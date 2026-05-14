// Botmaker webhook receiver — Milestone A
// Receives raw events from Botmaker, verifies auth-bm-token, persists to botmaker_events.
// Business processing happens in a later milestone.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-botmaker-signature, x-hub-signature-256, auth-bm-token",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const BOTMAKER_WEBHOOK_SECRET = Deno.env.get("BOTMAKER_WEBHOOK_SECRET") ?? "";

function timingSafeEq(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let res = 0;
  for (let i = 0; i < a.length; i++) res |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return res === 0;
}

function maskSecret(value: string | null): string {
  if (!value) return "missing";
  if (value.length <= 8) return `${value.slice(0, 2)}***${value.slice(-2)} (${value.length})`;
  return `${value.slice(0, 4)}***${value.slice(-4)} (${value.length})`;
}

function verifyBotmakerToken(req: Request): boolean {
  const received = req.headers.get("auth-bm-token");
  const expected = BOTMAKER_WEBHOOK_SECRET;
  const matches = Boolean(expected) && Boolean(received) && timingSafeEq(received, expected);

  console.log("[botmaker-webhook] auth-bm-token check", {
    received: maskSecret(received),
    expected: maskSecret(expected),
    expected_configured: Boolean(expected),
    matches,
  });

  return matches;
}

function pickEventId(payload: Record<string, unknown>): string | null {
  const candidates = ["eventId", "event_id", "id", "messageId", "message_id"];
  for (const k of candidates) {
    const v = payload[k];
    if (typeof v === "string" && v.length > 0) return v;
  }
  return null;
}

function extractMeta(payload: Record<string, any>) {
  return {
    event_type: String(
      payload.eventType ??
        payload.event_type ??
        payload.type ??
        "unknown",
    ),
    channel: payload.channel ?? payload.platform ?? null,
    conversation_id:
      payload.conversationId ??
      payload.conversation_id ??
      payload.chatId ??
      payload.chat_id ??
      null,
    customer_phone:
      payload.from ??
      payload.phone ??
      payload.customerPhone ??
      payload.customer_phone ??
      null,
    customer_name:
      payload.customerName ??
      payload.customer_name ??
      payload.contactName ??
      payload.contact_name ??
      null,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // Health check
  if (req.method === "GET") {
    return new Response(
      JSON.stringify({
        ok: true,
        service: "botmaker-webhook",
        auth_bm_token_check: BOTMAKER_WEBHOOK_SECRET ? "enabled" : "disabled",
        hmac_required: false,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "method_not_allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const rawBody = await req.text();
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // Botmaker static token verification. HMAC is intentionally not required.
  const tokenOk = verifyBotmakerToken(req);
  if (!tokenOk) {
    await supabase.from("botmaker_events").insert({
      event_type: "signature_invalid",
      payload: { reason: "Invalid or missing auth-bm-token" },
      processed: true,
      processing_error: "invalid_auth_bm_token",
    });
    return new Response(JSON.stringify({ error: "invalid_auth_bm_token" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let payload: Record<string, any>;
  try {
    payload = rawBody ? JSON.parse(rawBody) : {};
  } catch {
    return new Response(JSON.stringify({ error: "invalid_json" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const meta = extractMeta(payload);
  const event_id = pickEventId(payload);

  // Idempotency: if event_id present and already stored, ack OK
  if (event_id) {
    const { data: existing } = await supabase
      .from("botmaker_events")
      .select("id")
      .eq("event_id", event_id)
      .maybeSingle();
    if (existing) {
      return new Response(
        JSON.stringify({ ok: true, duplicate: true, id: existing.id }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
  }

  const { data, error } = await supabase
    .from("botmaker_events")
    .insert({
      event_id,
      ...meta,
      payload,
    })
    .select("id")
    .single();

  if (error) {
    console.error("[botmaker-webhook] insert failed", error.message);
    return new Response(JSON.stringify({ error: "insert_failed" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ ok: true, id: data.id }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
