// Admin-only simulator: invokes botmaker-create-booking server-side with the
// BOTMAKER_WEBHOOK_SECRET. Never exposes the secret to the browser.

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

function nextAvailableDate(): string {
  // Tomorrow, in America/Argentina/Buenos_Aires (UTC-3, no DST).
  const now = new Date();
  const ar = new Date(now.getTime() - 3 * 60 * 60 * 1000);
  ar.setUTCDate(ar.getUTCDate() + 1);
  return ar.toISOString().slice(0, 10);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST" && req.method !== "GET") {
    return json({ ok: false, error: "method_not_allowed" }, 405);
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const BM_SECRET = Deno.env.get("BOTMAKER_WEBHOOK_SECRET") ?? "";

  if (!BM_SECRET) {
    return json({ ok: false, error: "missing_BOTMAKER_WEBHOOK_SECRET" }, 500);
  }

  // Admin auth
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return json({ ok: false, error: "unauthorized" }, 401);
  }
  const token = authHeader.replace("Bearer ", "");
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
  const { data: userData, error: userErr } = await admin.auth.getUser(token);
  if (userErr || !userData?.user) {
    return json({ ok: false, error: "unauthorized" }, 401);
  }
  const { data: roleRow } = await admin
    .from("user_roles")
    .select("role")
    .eq("user_id", userData.user.id)
    .eq("role", "admin")
    .maybeSingle();
  if (!roleRow) return json({ ok: false, error: "forbidden" }, 403);

  const fakePayload = {
    conversation_id: "admin-simulation",
    channel: "whatsapp",
    customer_name: "Cliente Test Botmaker",
    customer_phone: "+5491170000000",
    address: "Av. del Libertador 1500",
    neighborhood: "San Isidro",
    vehicle_type: "Auto",
    service_type: "Lavado Básico",
    preferred_date: nextAvailableDate(),
    preferred_time: "10:00",
    payment_method: "pagar_despues",
    notes: "Simulación creada desde Admin Botmaker",
  };

  let upstreamStatus = 0;
  let upstreamBody: any = null;
  try {
    const r = await fetch(`${SUPABASE_URL}/functions/v1/botmaker-create-booking`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "auth-bm-token": BM_SECRET,
      },
      body: JSON.stringify(fakePayload),
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
      status: "error",
      error: `upstream_fetch_failed: ${(e as Error).message}`,
      payload: fakePayload,
    }, 502);
  }

  return json({
    ok: upstreamStatus < 400,
    upstream_status: upstreamStatus,
    payload: fakePayload,
    result: upstreamBody,
  });
});
