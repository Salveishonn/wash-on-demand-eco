// Admin-only simulator for botmaker-webhook events.
// Injects auth-bm-token server-side using BOTMAKER_WEBHOOK_SECRET.
// Never exposes the secret to the browser.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
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
  if (!authHeader?.startsWith("Bearer ")) {
    return json({ ok: false, error: "unauthorized" }, 401);
  }
  const token = authHeader.replace("Bearer ", "");
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
  const { data: userData, error: userErr } = await admin.auth.getUser(token);
  if (userErr || !userData?.user) return json({ ok: false, error: "unauthorized" }, 401);
  const { data: roleRow } = await admin
    .from("user_roles")
    .select("role")
    .eq("user_id", userData.user.id)
    .eq("role", "admin")
    .maybeSingle();
  if (!roleRow) return json({ ok: false, error: "forbidden" }, 403);

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  // mode: "authenticated" (default) sends with auth-bm-token,
  //       "unauthenticated" sends without — used for security verification.
  const mode = body?.mode === "unauthenticated" ? "unauthenticated" : "authenticated";

  if (mode === "authenticated" && !BM_SECRET) {
    return json({ ok: false, error: "missing_BOTMAKER_WEBHOOK_SECRET" }, 500);
  }

  const fakeEventId = `sim-${Date.now()}`;
  const payload = {
    eventId: fakeEventId,
    eventType: "message.user",
    channel: "whatsapp",
    from: "5491100000000",
    customerName: "Cliente Simulado (admin)",
    text: "Mensaje simulado desde Admin Botmaker",
    simulated: true,
    mode,
  };

  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (mode === "authenticated") headers["auth-bm-token"] = BM_SECRET;

  let upstreamStatus = 0;
  let upstreamBody: unknown = null;
  try {
    const r = await fetch(`${SUPABASE_URL}/functions/v1/botmaker-webhook`, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    });
    upstreamStatus = r.status;
    const text = await r.text();
    try {
      upstreamBody = JSON.parse(text);
    } catch {
      upstreamBody = { raw: text };
    }
  } catch (e) {
    return json({
      ok: false,
      mode,
      error: `upstream_fetch_failed: ${(e as Error).message}`,
    }, 502);
  }

  // Both outcomes are "ok" from a simulation standpoint:
  // - authenticated -> expect 2xx (accepted)
  // - unauthenticated -> expect 401 (rejected by security)
  const expectedOk =
    mode === "authenticated" ? upstreamStatus < 400 : upstreamStatus === 401;

  return json({
    ok: expectedOk,
    mode,
    upstream_status: upstreamStatus,
    result: upstreamBody,
    payload,
  });
});
