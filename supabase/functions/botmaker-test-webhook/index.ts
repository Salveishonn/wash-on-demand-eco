// Admin-only: server-side test of botmaker-webhook with the real secret.
// Never exposes BOTMAKER_WEBHOOK_SECRET to the browser.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ ok: false, error: "method_not_allowed" }, 405);

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const BM_SECRET = Deno.env.get("BOTMAKER_WEBHOOK_SECRET") ?? "";

  // Admin auth
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return json({ ok: false, error: "unauthorized" }, 401);
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);
  const { data: userData, error: userErr } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
  if (userErr || !userData?.user) return json({ ok: false, error: "unauthorized" }, 401);
  const { data: roleRow } = await supabase
    .from("user_roles").select("role").eq("user_id", userData.user.id).eq("role", "admin").maybeSingle();
  if (!roleRow) return json({ ok: false, error: "forbidden" }, 403);

  let body: any = {};
  try { body = await req.json(); } catch { /* */ }
  const mode: "with_token" | "without_token" | "summary_and_confirm" =
    body?.mode === "without_token" ? "without_token" :
    body?.mode === "summary_and_confirm" ? "summary_and_confirm" :
    "with_token";

  if (mode !== "without_token" && !BM_SECRET) {
    return json({ ok: false, error: "missing_BOTMAKER_WEBHOOK_SECRET" }, 500);
  }

  const baseHeaders: Record<string, string> = { "Content-Type": "application/json" };
  if (mode !== "without_token") baseHeaders["auth-bm-token"] = BM_SECRET;
  const url = `${SUPABASE_URL}/functions/v1/botmaker-webhook`;

  // ── Mode: simple test ping
  if (mode === "with_token" || mode === "without_token") {
    const payload = {
      eventId: `admin-test-${Date.now()}`,
      eventType: "message.user",
      channel: "whatsapp",
      from: "5491100000000",
      customerName: "Admin Test",
      text: "Ping desde Admin",
      simulated: true,
    };
    let upstreamStatus = 0;
    let upstreamBody: unknown = null;
    try {
      const r = await fetch(url, { method: "POST", headers: baseHeaders, body: JSON.stringify(payload) });
      upstreamStatus = r.status;
      const text = await r.text();
      try { upstreamBody = JSON.parse(text); } catch { upstreamBody = { raw: text }; }
    } catch (e) {
      return json({ ok: false, mode, error: `upstream_fetch_failed: ${(e as Error).message}` }, 502);
    }
    const expectedOk = mode === "with_token" ? upstreamStatus < 400 : upstreamStatus === 401;
    return json({ ok: expectedOk, mode, upstream_status: upstreamStatus, result: upstreamBody });
  }

  // ── Mode: summary + confirmation simulator (creates is_test booking_request)
  // Strategy: directly insert a synthetic conversation + 2 messages, then call the
  // webhook with the user "sí" event so the parser path runs end-to-end.
  const conversation_id = `sim-conv-${Date.now()}`;
  const phone = "5491100000000";
  const name = "Salvador (simulación)";
  const summary = [
    "Perfecto, tengo estos datos:",
    "Nombre completo: Salvador Marin",
    "Dirección: San Luis 548, Ingeniero Maschwitz",
    "Zona: Maschwitz",
    "Vehículo: SUV",
    "Servicio: Lavado Completo",
    "Día: Mañana",
    "Horario: 16 hs",
    "Pago: Pagar después",
    "¿Confirmás que está todo bien?",
  ].join("\n");

  // Insert bot summary message directly
  await supabase.from("botmaker_conversations").upsert({
    conversation_id, customer_phone: phone, customer_name: name,
    channel: "whatsapp", last_message_at: new Date().toISOString(),
    last_message_preview: summary.slice(0, 140), last_direction: "out", last_sender_type: "bot",
  }, { onConflict: "conversation_id" });

  await supabase.from("botmaker_messages").insert({
    conversation_id, direction: "out", sender: "bot", body: summary, message_type: "text",
    raw: { simulated: true, type: "summary" },
  });

  // Now call webhook with the user confirmation
  const confirmPayload = {
    eventId: `sim-confirm-${Date.now()}`,
    eventType: "message.user",
    channel: "whatsapp",
    chatId: conversation_id,
    from: phone,
    customerName: name,
    text: "sí",
    direction: "in",
  };
  let upstreamStatus = 0;
  let upstreamBody: any = null;
  try {
    const r = await fetch(url, { method: "POST", headers: baseHeaders, body: JSON.stringify(confirmPayload) });
    upstreamStatus = r.status;
    const text = await r.text();
    try { upstreamBody = JSON.parse(text); } catch { upstreamBody = { raw: text }; }
  } catch (e) {
    return json({ ok: false, mode, error: `upstream_fetch_failed: ${(e as Error).message}` }, 502);
  }

  // Mark created request as test, if any
  const created_id = upstreamBody?.booking?.created_id ?? null;
  if (created_id) {
    await supabase.from("booking_requests").update({ is_test: true }).eq("id", created_id);
  }

  return json({
    ok: upstreamStatus < 400,
    mode,
    upstream_status: upstreamStatus,
    conversation_id,
    booking_request_id: created_id,
    result: upstreamBody,
  });
});
