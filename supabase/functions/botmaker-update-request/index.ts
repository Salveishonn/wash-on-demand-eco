// Admin-only updater for booking_requests: status transitions, reasons,
// is_test toggle. Used by the Botmaker admin tab actions.

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

type Action = "request_more_info" | "reject" | "toggle_test";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ ok: false, error: "method_not_allowed" }, 405);

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

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
  const request_id: string | undefined = body?.request_id;
  const action: Action | undefined = body?.action;
  const reason: string | undefined = body?.reason;
  if (!request_id || !action) return json({ ok: false, error: "missing_request_id_or_action" }, 400);

  const { data: current } = await supabase
    .from("booking_requests").select("id, is_test, status").eq("id", request_id).maybeSingle();
  if (!current) return json({ ok: false, error: "not_found" }, 404);

  const update: Record<string, unknown> = { updated_at: new Date().toISOString(), reviewed_at: new Date().toISOString() };
  if (action === "request_more_info") {
    update.status = "waiting_customer";
    if (reason) update.review_reason = reason;
  } else if (action === "reject") {
    if (!reason || !reason.trim()) return json({ ok: false, error: "reason_required" }, 400);
    update.status = "rejected";
    update.review_reason = reason.trim();
  } else if (action === "toggle_test") {
    update.is_test = !current.is_test;
  } else {
    return json({ ok: false, error: "unknown_action" }, 400);
  }

  const { error } = await supabase.from("booking_requests").update(update).eq("id", request_id);
  if (error) return json({ ok: false, error: error.message }, 500);
  return json({ ok: true, request_id, action, update });
});
