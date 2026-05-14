// Admin-only: convert a booking_request into a real booking.
// Auth: requires logged-in admin. Verifies JWT via getClaims, then has_role.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import {
  validateAvailability,
  validateCoverage,
} from "../_shared/bookingDomain.ts";
import { normalizePhoneE164 } from "../_shared/phoneUtils.ts";

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

function mapPaymentMethodToDb(label: string | null | undefined): string {
  if (!label) return "pay_later";
  const l = String(label).toLowerCase();
  if (l.includes("mercado") || l === "online") return "online";
  if (l.includes("transfer")) return "transfer";
  return "pay_later";
}

function mapServiceCode(name: string | null | undefined): { code: string; name: string } | null {
  if (!name) return null;
  const lower = String(name).toLowerCase();
  if (lower.includes("complet")) return { code: "lavado_completo", name: "Lavado Completo" };
  if (lower.includes("básic") || lower.includes("basic")) return { code: "lavado_basico", name: "Lavado Básico" };
  return null;
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

  // JWT decode → user id
  let userId: string | null = null;
  try {
    const parts = token.split(".");
    if (parts.length === 3) {
      const payload = JSON.parse(atob(parts[1].replace(/-/g, "+").replace(/_/g, "/")));
      if (payload?.exp && payload.exp * 1000 > Date.now()) userId = payload.sub ?? null;
    }
  } catch (_e) {
    // fall through
  }
  if (!userId) {
    const { data: u } = await supabase.auth.getUser(token);
    userId = u?.user?.id ?? null;
  }
  if (!userId) return jsonResponse({ ok: false, error: "invalid_jwt" }, 401);

  const { data: roleRow } = await supabase
    .from("user_roles").select("role").eq("user_id", userId).eq("role", "admin").maybeSingle();
  if (!roleRow) return jsonResponse({ ok: false, error: "forbidden" }, 403);

  let body: any = {};
  try { body = await req.json(); } catch { return jsonResponse({ ok: false, error: "invalid_json" }, 400); }
  const requestId = body?.request_id;
  const overrides = body?.overrides ?? {};
  if (!requestId) return jsonResponse({ ok: false, error: "missing_request_id" }, 400);

  const { data: bookingReq, error: reqErr } = await supabase
    .from("booking_requests").select("*").eq("id", requestId).maybeSingle();
  if (reqErr || !bookingReq) return jsonResponse({ ok: false, error: "request_not_found" }, 404);

  // Apply overrides on top of request data
  const merged = {
    customer_name: overrides.customer_name ?? bookingReq.customer_name,
    customer_phone: overrides.customer_phone ?? bookingReq.customer_phone,
    customer_email: overrides.customer_email ?? "",
    address: overrides.address ?? bookingReq.address,
    neighborhood: overrides.neighborhood ?? bookingReq.neighborhood,
    vehicle_type: overrides.vehicle_type ?? bookingReq.vehicle_type,
    service_type: overrides.service_type ?? bookingReq.service_type,
    preferred_date: overrides.preferred_date ?? bookingReq.preferred_date,
    preferred_time: overrides.preferred_time ?? bookingReq.preferred_time,
    payment_method: overrides.payment_method ?? bookingReq.payment_method,
    notes: overrides.notes ?? bookingReq.notes,
  };

  const required = ["customer_name", "customer_phone", "address", "service_type", "preferred_date", "preferred_time"];
  const missing = required.filter((k) => !merged[k as keyof typeof merged]);
  if (missing.length) return jsonResponse({ ok: false, error: "missing_fields", missing });

  const phoneE164 = normalizePhoneE164(merged.customer_phone);
  const service = mapServiceCode(merged.service_type);
  if (!service) return jsonResponse({ ok: false, error: "unknown_service" }, 400);

  const coverage = validateCoverage(merged.address);
  if (!coverage.allowed) return jsonResponse({ ok: false, error: "out_of_coverage", reason: coverage.reason });

  const avail = await validateAvailability(supabase, merged.preferred_date, merged.preferred_time);
  if (!avail.available) return jsonResponse({ ok: false, error: "slot_unavailable", reason: avail.reason });

  // Pricing
  let basePriceCents = 0;
  let pricingVersionId: string | null = null;
  const { data: pv } = await supabase.from("pricing_versions").select("id")
    .eq("is_active", true).order("version_number", { ascending: false }).limit(1).maybeSingle();
  if (pv) {
    pricingVersionId = pv.id;
    const { data: items } = await supabase.from("pricing_items")
      .select("item_code, item_type, price_ars").eq("pricing_version_id", pv.id);
    const svc = items?.find((i: any) => i.item_type === "service" && i.item_code === service.code);
    if (svc) basePriceCents = Math.round(svc.price_ars * 100);
  }

  // Customer sync
  let customerId: string | null = null;
  const { data: existingCust } = await supabase.from("customers").select("id").eq("phone_e164", phoneE164).maybeSingle();
  if (existingCust) {
    customerId = existingCust.id;
  } else {
    const { data: newCust } = await supabase.from("customers").insert({
      full_name: merged.customer_name,
      phone_e164: phoneE164,
      botmaker_conversation_id: bookingReq.botmaker_conversation_id,
      last_contact_channel: "whatsapp",
      communication_source: "botmaker",
      last_contact_at: new Date().toISOString(),
    }).select("id").single();
    customerId = newCust?.id ?? null;
  }

  const paymentDb = mapPaymentMethodToDb(merged.payment_method);

  const { data: booking, error: bookingErr } = await supabase.from("bookings").insert({
    customer_id: customerId,
    customer_name: merged.customer_name,
    customer_email: merged.customer_email || "",
    customer_phone: phoneE164,
    service_name: service.name,
    service_code: service.code,
    service_price_cents: basePriceCents,
    base_price_ars: Math.round(basePriceCents / 100),
    total_price_ars: Math.round(basePriceCents / 100),
    final_price_ars: Math.round(basePriceCents / 100),
    vehicle_size: merged.vehicle_type,
    car_type: merged.vehicle_type,
    booking_date: merged.preferred_date,
    booking_time: merged.preferred_time,
    address: merged.address,
    barrio: merged.neighborhood,
    notes: merged.notes,
    status: "pending",
    payment_status: "pending",
    payment_method: paymentDb,
    requires_payment: paymentDb !== "pay_later",
    booking_source: "botmaker",
    created_from: "botmaker",
    communication_channel: "whatsapp",
    botmaker_conversation_id: bookingReq.botmaker_conversation_id,
    pricing_version_id: pricingVersionId,
    whatsapp_opt_in: true,
    is_test: bookingReq.is_test ?? false,
  }).select("id, booking_date, booking_time").single();

  if (bookingErr || !booking) {
    return jsonResponse({ ok: false, error: "booking_insert_failed", details: bookingErr?.message });
  }

  await supabase.from("booking_requests").update({
    status: "converted",
    resulting_booking_id: booking.id,
    reviewed_at: new Date().toISOString(),
  }).eq("id", requestId);

  return jsonResponse({ ok: true, booking_id: booking.id, booking });
});
