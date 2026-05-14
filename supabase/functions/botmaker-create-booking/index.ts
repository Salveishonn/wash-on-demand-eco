// Botmaker → Washero direct booking endpoint
// Receives WhatsApp-collected booking data, validates with Washero rules,
// creates a real booking or a booking_request for manual review.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import {
  validateAvailability,
  validateCoverage,
} from "../_shared/bookingDomain.ts";
import { normalizePhoneE164 } from "../_shared/phoneUtils.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, auth-bm-token",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const REQUIRED_FIELDS = [
  "customer_phone",
  "customer_name",
  "address",
  "preferred_date",
  "preferred_time",
  "service_type",
] as const;

type ServiceMap = { code: string; name: string };

function mapService(input: string | undefined): ServiceMap | null {
  if (!input) return null;
  const lower = input.toLowerCase().trim();
  if (lower.includes("complet")) return { code: "lavado_completo", name: "Lavado Completo" };
  if (lower.includes("básic") || lower.includes("basic") || lower.includes("basico"))
    return { code: "lavado_basico", name: "Lavado Básico" };
  return null;
}

function mapPaymentMethod(input: string | undefined): string {
  if (!input) return "pay_later";
  const l = input.toLowerCase().trim();
  if (l.includes("mercado")) return "online";
  if (l.includes("transfer")) return "transfer";
  return "pay_later";
}

function normalizeDate(input: string | undefined): string | null {
  if (!input) return null;
  const trimmed = input.trim();
  // YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  // DD/MM or DD/MM/YYYY
  const m = trimmed.match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?$/);
  if (m) {
    const day = m[1].padStart(2, "0");
    const month = m[2].padStart(2, "0");
    const year = m[3] ? (m[3].length === 2 ? `20${m[3]}` : m[3]) : new Date().getFullYear().toString();
    return `${year}-${month}-${day}`;
  }
  if (trimmed.toLowerCase() === "mañana" || trimmed.toLowerCase() === "manana") {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().slice(0, 10);
  }
  if (trimmed.toLowerCase() === "hoy") {
    return new Date().toISOString().slice(0, 10);
  }
  return null;
}

function normalizeTime(input: string | undefined): string | null {
  if (!input) return null;
  const trimmed = input.trim();
  const m = trimmed.match(/^(\d{1,2}):?(\d{2})?$/);
  if (m) {
    const h = parseInt(m[1], 10);
    const min = m[2] ? parseInt(m[2], 10) : 0;
    if (h < 0 || h > 23 || min < 0 || min > 59) return null;
    return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
  }
  return null;
}

async function logAttempt(
  supabase: any,
  data: {
    conversation_id?: string;
    customer_phone?: string;
    payload: any;
    normalized_payload?: any;
    result_status: string;
    booking_id?: string;
    booking_request_id?: string;
    error?: string;
  },
) {
  try {
    await supabase.from("botmaker_booking_logs").insert(data);
  } catch (e) {
    console.error("[botmaker-create-booking] log insert failed", e);
  }
}

async function notifyOps(supabase: any, title: string, body: string, payload: any) {
  try {
    await supabase.from("operator_notifications").insert({
      event_type: "botmaker_booking",
      title,
      body,
      data: payload,
    });
  } catch (e) {
    console.error("[botmaker-create-booking] notify failed", e);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ ok: false, error: "method_not_allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Auth
  const expected = Deno.env.get("BOTMAKER_WEBHOOK_SECRET") ?? "";
  const received = req.headers.get("auth-bm-token") ?? "";
  if (!expected || received !== expected) {
    return new Response(JSON.stringify({ ok: false, error: "unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  let payload: any = {};
  try {
    payload = await req.json();
  } catch {
    return new Response(JSON.stringify({ ok: false, error: "invalid_json" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const conversation_id = payload.conversation_id ?? null;
  const aiSummary = (payload.ai_booking_summary ?? payload.aiBookingSummary ?? "").toString().trim();
  const rawConversation = payload.raw_conversation ?? payload.rawConversation ?? null;

  // Required fields check
  const missing = REQUIRED_FIELDS.filter((f) => !payload?.[f] || String(payload[f]).trim() === "");
  if (missing.length > 0) {
    // AI summary fallback path: as long as we can identify the customer phone and have
    // SOME conversation context, queue a needs_review request instead of bouncing.
    if (payload.customer_phone && (aiSummary || rawConversation)) {
      const phoneE164Fallback = normalizePhoneE164(payload.customer_phone);
      const { data: reqRow, error: reqErr } = await supabase
        .from("booking_requests")
        .insert({
          customer_name: payload.customer_name ?? null,
          customer_phone: phoneE164Fallback,
          address: payload.address ?? null,
          neighborhood: payload.neighborhood ?? null,
          vehicle_type: payload.vehicle_type ?? null,
          service_type: payload.service_type ?? null,
          preferred_date: null,
          preferred_time: null,
          notes: aiSummary || payload.notes || null,
          status: "needs_review",
          source: "botmaker",
          channel: "whatsapp",
          botmaker_conversation_id: conversation_id,
          raw_payload: { ...payload, ai_booking_summary: aiSummary, raw_conversation: rawConversation, missing_fields: missing },
        })
        .select("id")
        .single();
      await logAttempt(supabase, {
        conversation_id,
        customer_phone: phoneE164Fallback,
        payload,
        result_status: "needs_review",
        booking_request_id: reqRow?.id,
        error: reqErr?.message ?? `ai_summary_fallback missing:${missing.join(",")}`,
      });
      if (reqRow?.id) {
        await notifyOps(
          supabase,
          "Pedido de reserva (resumen IA) desde Botmaker",
          `${payload.customer_name ?? "Sin nombre"} · ${phoneE164Fallback}`,
          { request_id: reqRow.id, ai_booking_summary: aiSummary },
        );
      }
      return new Response(
        JSON.stringify({
          ok: true,
          status: "needs_review",
          request_id: reqRow?.id ?? null,
          message: "Gracias 🙌 Recibimos tu pedido. Un asesor de Washero revisa los detalles y te confirma por WhatsApp.",
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const msg = `Me falta un dato para completar la reserva. Necesito: ${missing.join(", ")}.`;
    await logAttempt(supabase, {
      conversation_id,
      customer_phone: payload.customer_phone,
      payload,
      result_status: "missing_data",
      error: `missing: ${missing.join(",")}`,
    });
    return new Response(
      JSON.stringify({ ok: false, status: "missing_data", missing_fields: missing, message: msg }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  // Normalize
  const phoneE164 = normalizePhoneE164(payload.customer_phone);
  const date = normalizeDate(payload.preferred_date);
  const time = normalizeTime(payload.preferred_time);
  const service = mapService(payload.service_type);
  const paymentMethod = mapPaymentMethod(payload.payment_method);

  const normalized = {
    conversation_id,
    customer_phone: phoneE164,
    customer_name: String(payload.customer_name).trim(),
    address: String(payload.address).trim(),
    neighborhood: payload.neighborhood ?? null,
    vehicle_type: payload.vehicle_type ?? null,
    service_type: payload.service_type,
    service_code: service?.code ?? null,
    service_name: service?.name ?? null,
    preferred_date: date,
    preferred_time: time,
    payment_method: paymentMethod,
    notes: payload.notes ?? null,
  };

  // Helper: create booking_request and return response
  const createBookingRequest = async (
    status: string,
    message: string,
    extra?: Record<string, any>,
  ) => {
    const { data: req, error } = await supabase
      .from("booking_requests")
      .insert({
        customer_name: normalized.customer_name,
        customer_phone: phoneE164,
        address: normalized.address,
        neighborhood: normalized.neighborhood,
        vehicle_type: normalized.vehicle_type,
        service_type: normalized.service_type,
        preferred_date: date,
        preferred_time: time,
        notes: normalized.notes,
        status,
        source: "botmaker",
        channel: "whatsapp",
        botmaker_conversation_id: conversation_id,
        raw_payload: payload,
      })
      .select("id")
      .single();

    if (error) {
      console.error("[botmaker-create-booking] booking_request insert error", error);
    }

    await logAttempt(supabase, {
      conversation_id,
      customer_phone: phoneE164,
      payload,
      normalized_payload: normalized,
      result_status: status,
      booking_request_id: req?.id,
      error: error?.message,
    });

    if (req?.id) {
      await notifyOps(
        supabase,
        "Nuevo pedido de reserva desde Botmaker",
        `${normalized.customer_name} · ${date ?? "fecha?"} ${time ?? ""} · ${status}`,
        { request_id: req.id, ...normalized, ...extra },
      );
    }

    return new Response(
      JSON.stringify({
        ok: status === "needs_review",
        status,
        request_id: req?.id ?? null,
        message,
        ...(extra ?? {}),
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  };

  // Validate normalization
  if (!date || !time || !service) {
    return await createBookingRequest(
      "needs_review",
      "Gracias 🙌 Recibimos tu pedido de reserva. Un asesor de Washero va a revisar disponibilidad y te confirma por WhatsApp.",
    );
  }

  // Coverage check
  const coverage = validateCoverage(normalized.address);
  if (!coverage.allowed) {
    return await createBookingRequest("needs_review", coverage.reason ?? "Necesitamos revisar tu zona.");
  }

  // Availability
  const avail = await validateAvailability(supabase, date, time);
  if (!avail.available) {
    await logAttempt(supabase, {
      conversation_id,
      customer_phone: phoneE164,
      payload,
      normalized_payload: normalized,
      result_status: "slot_unavailable",
      error: avail.reason,
    });
    return new Response(
      JSON.stringify({
        ok: false,
        status: "slot_unavailable",
        message: "Ese horario no está disponible 😅 Probá con otro día u horario.",
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  // Duplicate check
  const { data: dup } = await supabase
    .from("bookings")
    .select("id")
    .eq("customer_phone", phoneE164)
    .eq("booking_date", date)
    .eq("booking_time", time)
    .neq("status", "cancelled")
    .maybeSingle();

  if (dup) {
    await logAttempt(supabase, {
      conversation_id,
      customer_phone: phoneE164,
      payload,
      normalized_payload: normalized,
      result_status: "duplicate",
      booking_id: dup.id,
    });
    return new Response(
      JSON.stringify({
        ok: false,
        status: "duplicate",
        booking_id: dup.id,
        message:
          "Ya tenemos una reserva registrada para ese teléfono en ese día y horario. Si querés modificarla, te derivamos con el equipo Washero.",
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  // Customer sync
  const { data: existingCust } = await supabase
    .from("customers")
    .select("id, full_name, email")
    .eq("phone_e164", phoneE164)
    .maybeSingle();

  let customerId = existingCust?.id ?? null;
  if (existingCust) {
    await supabase
      .from("customers")
      .update({
        full_name: existingCust.full_name || normalized.customer_name,
        botmaker_conversation_id: conversation_id,
        last_contact_channel: "whatsapp",
        communication_source: "botmaker",
        last_contact_at: new Date().toISOString(),
      })
      .eq("id", existingCust.id);
  } else {
    const { data: newCust } = await supabase
      .from("customers")
      .insert({
        full_name: normalized.customer_name,
        phone_e164: phoneE164,
        botmaker_conversation_id: conversation_id,
        last_contact_channel: "whatsapp",
        communication_source: "botmaker",
        last_contact_at: new Date().toISOString(),
      })
      .select("id")
      .single();
    customerId = newCust?.id ?? null;
  }

  // Resolve pricing for the service from active pricing version
  let basePriceCents = 0;
  const { data: pv } = await supabase
    .from("pricing_versions")
    .select("id")
    .eq("is_active", true)
    .order("version_number", { ascending: false })
    .limit(1)
    .maybeSingle();
  let pricingVersionId = pv?.id ?? null;
  if (pricingVersionId) {
    const { data: items } = await supabase
      .from("pricing_items")
      .select("item_code, item_type, price_ars")
      .eq("pricing_version_id", pricingVersionId);
    const svc = items?.find((i: any) => i.item_type === "service" && i.item_code === service.code);
    if (svc) basePriceCents = Math.round(svc.price_ars * 100);
  }

  // Create real booking
  const { data: booking, error: bookingErr } = await supabase
    .from("bookings")
    .insert({
      customer_id: customerId,
      customer_name: normalized.customer_name,
      customer_email: payload.customer_email ?? "",
      customer_phone: phoneE164,
      service_name: service.name,
      service_code: service.code,
      service_price_cents: basePriceCents,
      base_price_ars: Math.round(basePriceCents / 100),
      total_price_ars: Math.round(basePriceCents / 100),
      final_price_ars: Math.round(basePriceCents / 100),
      vehicle_size: normalized.vehicle_type,
      car_type: normalized.vehicle_type,
      booking_date: date,
      booking_time: time,
      address: normalized.address,
      barrio: normalized.neighborhood,
      notes: normalized.notes,
      status: "pending",
      payment_status: "pending",
      payment_method: paymentMethod,
      requires_payment: paymentMethod !== "pay_later",
      booking_source: "botmaker",
      created_from: "botmaker",
      communication_channel: "whatsapp",
      botmaker_conversation_id: conversation_id,
      pricing_version_id: pricingVersionId,
      whatsapp_opt_in: true,
    })
    .select("id, booking_date, booking_time")
    .single();

  if (bookingErr || !booking) {
    console.error("[botmaker-create-booking] booking insert error", bookingErr);
    await logAttempt(supabase, {
      conversation_id,
      customer_phone: phoneE164,
      payload,
      normalized_payload: normalized,
      result_status: "error",
      error: bookingErr?.message ?? "unknown insert error",
    });
    return new Response(
      JSON.stringify({
        ok: false,
        status: "error",
        message: "No pudimos crear la reserva. Te contactamos en breve.",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  await logAttempt(supabase, {
    conversation_id,
    customer_phone: phoneE164,
    payload,
    normalized_payload: normalized,
    result_status: "booking_created",
    booking_id: booking.id,
  });

  await notifyOps(
    supabase,
    "Nueva reserva desde WhatsApp 🚗",
    `${normalized.customer_name} · ${booking.booking_date} ${booking.booking_time} · ${service.name}`,
    { booking_id: booking.id, ...normalized },
  );

  return new Response(
    JSON.stringify({
      ok: true,
      status: "booking_created",
      booking_id: booking.id,
      message: `Listo 🚗✨ Tu reserva fue creada para el ${booking.booking_date} a las ${booking.booking_time}. Te vamos a contactar por WhatsApp para confirmar cualquier detalle.`,
    }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
