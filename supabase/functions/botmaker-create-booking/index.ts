// Botmaker → Washero direct booking endpoint (hardened)
// Accepts structured payloads AND AI-summary payloads.
// Always returns a friendly Spanish customer_message; never leaks technical errors.
// Strips Botmaker {{...}} and ${...} placeholders before persisting.

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

const FRIENDLY_ACK =
  "Gracias 🙌 Recibimos tu pedido de reserva. Un asesor de Washero va a revisar disponibilidad y te confirma por WhatsApp.";
const FRIENDLY_CONFIRMED = (date: string, time: string) =>
  `¡Listo! ✅ Reservamos tu lavado para el ${date} a las ${time}. Te confirmamos por WhatsApp.`;
const FRIENDLY_SLOT_TAKEN =
  "Ese horario ya no está disponible 😅 Probá con otro día u horario y te lo confirmamos enseguida.";
const FRIENDLY_DUPLICATE =
  "Ya tenemos una reserva registrada para tu número en ese día y horario. Si querés modificarla, te derivamos con el equipo Washero.";
const FRIENDLY_ERROR =
  "Recibimos tu pedido pero estamos teniendo un problema técnico. Un asesor de Washero te contacta en breve.";
const FRIENDLY_UNAUTHORIZED = "No pudimos procesar el pedido en este momento.";

// ──────────────────────────────────────────────────────────────────────────
// 1) Cleaning helpers
// ──────────────────────────────────────────────────────────────────────────

function cleanValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  const text = String(value).trim();
  if (!text) return "";
  const lower = text.toLowerCase();
  if (lower === "undefined" || lower === "null") return "";
  if (/^\{\{.+\}\}$/.test(text)) return "";
  if (/^\$\{.+\}$/.test(text)) return "";
  // also strip embedded placeholders if the whole field is mostly placeholder
  if (/^[\s{}\$]+$/.test(text)) return "";
  return text;
}

function logStep(step: string, data: Record<string, unknown> = {}) {
  try {
    console.log(`[botmaker-create-booking] ${step}`, JSON.stringify(data));
  } catch {
    console.log(`[botmaker-create-booking] ${step}`);
  }
}

// ──────────────────────────────────────────────────────────────────────────
// 2) Spanish/Rioplatense parsing
// ──────────────────────────────────────────────────────────────────────────

const TZ = "America/Argentina/Buenos_Aires";

function nowInBuenosAires(): Date {
  // Build a Date that *represents* the current Buenos Aires wall-clock in local components
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const parts = Object.fromEntries(
    fmt.formatToParts(new Date()).filter((p) => p.type !== "literal").map((p) => [p.type, p.value]),
  ) as Record<string, string>;
  return new Date(
    `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}`,
  );
}

function ymd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

const WEEKDAY_MAP: Record<string, number> = {
  domingo: 0, lunes: 1, martes: 2, miercoles: 3, "miércoles": 3,
  jueves: 4, viernes: 5, sabado: 6, "sábado": 6,
};

function stripAccents(s: string): string {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function parseRelativeDate(input: string): string | null {
  if (!input) return null;
  const raw = input.trim();
  // ISO YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  // DD/MM[/YYYY]
  const slash = raw.match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?$/);
  if (slash) {
    const day = slash[1].padStart(2, "0");
    const month = slash[2].padStart(2, "0");
    const year = slash[3]
      ? (slash[3].length === 2 ? `20${slash[3]}` : slash[3])
      : String(nowInBuenosAires().getFullYear());
    return `${year}-${month}-${day}`;
  }
  const lower = stripAccents(raw.toLowerCase());
  const today = nowInBuenosAires();
  if (lower === "hoy") return ymd(today);
  if (lower === "manana" || lower === "mañana") {
    const d = new Date(today); d.setDate(d.getDate() + 1); return ymd(d);
  }
  if (lower.includes("pasado manana") || lower.includes("pasado mañana")) {
    const d = new Date(today); d.setDate(d.getDate() + 2); return ymd(d);
  }
  // "lunes que viene", "el martes", "este viernes"
  for (const [name, target] of Object.entries(WEEKDAY_MAP)) {
    const nameNorm = stripAccents(name);
    if (lower.includes(nameNorm)) {
      const todayDow = today.getDay();
      let diff = target - todayDow;
      if (diff <= 0 || lower.includes("que viene") || lower.includes("proximo") || lower.includes("próximo")) {
        diff += 7;
      }
      const d = new Date(today); d.setDate(d.getDate() + diff); return ymd(d);
    }
  }
  return null;
}

function parseTime(input: string): string | null {
  if (!input) return null;
  const lower = stripAccents(input.toLowerCase()).trim();
  // "10 am", "11am", "10:30", "a las 11", "a las 10:30"
  const m1 = lower.match(/(\d{1,2})(?:[:.](\d{2}))?\s*(am|pm)?/);
  if (m1) {
    let h = parseInt(m1[1], 10);
    const min = m1[2] ? parseInt(m1[2], 10) : 0;
    const mer = m1[3];
    if (mer === "pm" && h < 12) h += 12;
    if (mer === "am" && h === 12) h = 0;
    if (h >= 0 && h <= 23 && min >= 0 && min <= 59) {
      return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
    }
  }
  return null;
}

function parseService(input: string): { code: string; name: string } | null {
  const lower = stripAccents(input.toLowerCase());
  if (lower.includes("complet")) return { code: "lavado_completo", name: "Lavado Completo" };
  if (lower.includes("basic")) return { code: "lavado_basico", name: "Lavado Básico" };
  return null;
}

function parseVehicle(input: string): string | null {
  const lower = stripAccents(input.toLowerCase());
  if (lower.includes("suv")) return "SUV";
  if (lower.includes("pick") || lower.includes("camioneta")) return "Pick-up";
  if (lower.includes("auto") || lower.includes("sedan") || lower.includes("hatchback")) return "Auto";
  return null;
}

function parsePayment(input: string): string | null {
  const lower = stripAccents(input.toLowerCase());
  if (lower.includes("mercado") || lower.includes("mp ") || lower === "mp") return "MercadoPago";
  if (lower.includes("transfer")) return "Transferencia";
  if (lower.includes("despue") || lower.includes("efectivo") || lower.includes("cash")) return "Pagar después";
  return null;
}

function mapPaymentMethodToDb(label: string | null): string {
  if (!label) return "pay_later";
  const l = label.toLowerCase();
  if (l.includes("mercado")) return "online";
  if (l.includes("transfer")) return "transfer";
  return "pay_later";
}

// Parse loose AI summary like:
//  "Nombre: Salvador, Dirección: San Luis 548, Zona: Maschwitz, Vehículo: SUV,
//   Servicio: Lavado Básico, Día: Mañana, Horario: 10 am, Pago: Pagar después"
function parseAiSummary(summary: string) {
  const out: Record<string, string> = {};
  if (!summary) return out;
  // Normalize separators
  const normalized = summary.replace(/\n/g, ",");
  const fields: Array<[RegExp, string]> = [
    [/nombre\s*[:\-]\s*([^,;]+)/i, "customer_name"],
    [/(?:direcci[oó]n|domicilio|calle)\s*[:\-]\s*([^,;]+)/i, "address"],
    [/(?:zona|barrio|localidad)\s*[:\-]\s*([^,;]+)/i, "neighborhood"],
    [/(?:veh[ií]culo|auto|coche)\s*[:\-]\s*([^,;]+)/i, "vehicle_type"],
    [/(?:servicio|lavado)\s*[:\-]\s*([^,;]+)/i, "service_type"],
    [/(?:d[ií]a|fecha)\s*[:\-]\s*([^,;]+)/i, "preferred_date"],
    [/(?:horario|hora)\s*[:\-]\s*([^,;]+)/i, "preferred_time"],
    [/pago\s*[:\-]\s*([^,;]+)/i, "payment_method"],
    [/tel[eé]fono\s*[:\-]\s*([^,;]+)/i, "customer_phone"],
  ];
  for (const [re, key] of fields) {
    const m = normalized.match(re);
    if (m && m[1]) out[key] = m[1].trim();
  }
  return out;
}

// ──────────────────────────────────────────────────────────────────────────
// 3) Logging + ops notification helpers
// ──────────────────────────────────────────────────────────────────────────

async function logAttempt(
  supabase: any,
  data: {
    conversation_id?: string | null;
    customer_phone?: string | null;
    payload: any;
    normalized_payload?: any;
    result_status: string;
    booking_id?: string | null;
    booking_request_id?: string | null;
    error?: string | null;
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

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// ──────────────────────────────────────────────────────────────────────────
// 4) Main handler
// ──────────────────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") {
    return jsonResponse({ ok: false, status: "method_not_allowed", customer_message: FRIENDLY_ERROR }, 405);
  }

  logStep("request_received", { method: req.method });

  // Auth
  const expected = Deno.env.get("BOTMAKER_WEBHOOK_SECRET") ?? "";
  const received = req.headers.get("auth-bm-token") ?? "";
  if (!expected || received !== expected) {
    logStep("auth_invalid", { has_header: Boolean(received), expected_configured: Boolean(expected) });
    // Always return 200 with friendly message so Botmaker doesn't loop the user.
    return jsonResponse({
      ok: false,
      status: "unauthorized",
      customer_message: FRIENDLY_UNAUTHORIZED,
    });
  }
  logStep("auth_valid");

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  let payload: any = {};
  try {
    payload = await req.json();
  } catch {
    return jsonResponse({ ok: false, status: "invalid_json", customer_message: FRIENDLY_ERROR }, 400);
  }
  logStep("raw_payload_received", { keys: Object.keys(payload) });

  // ─── Clean every incoming field
  const cleaned = {
    conversation_id: cleanValue(payload.conversation_id),
    channel: cleanValue(payload.channel) || "whatsapp",
    customer_name: cleanValue(payload.customer_name),
    customer_phone: cleanValue(payload.customer_phone),
    customer_email: cleanValue(payload.customer_email),
    address: cleanValue(payload.address),
    neighborhood: cleanValue(payload.neighborhood),
    vehicle_type: cleanValue(payload.vehicle_type),
    service_type: cleanValue(payload.service_type),
    preferred_date: cleanValue(payload.preferred_date),
    preferred_time: cleanValue(payload.preferred_time),
    payment_method: cleanValue(payload.payment_method),
    notes: cleanValue(payload.notes),
    ai_booking_summary: cleanValue(payload.ai_booking_summary ?? payload.aiBookingSummary),
    raw_conversation: cleanValue(payload.raw_conversation ?? payload.rawConversation),
  };
  logStep("placeholders_removed", {
    has_summary: Boolean(cleaned.ai_booking_summary),
    structured_field_count: Object.values(cleaned).filter((v) => v && v !== "whatsapp").length,
  });

  // ─── If structured fields are missing, try to extract from AI summary
  const fromSummary = cleaned.ai_booking_summary ? parseAiSummary(cleaned.ai_booking_summary) : {};
  const merged = {
    customer_name: cleaned.customer_name || fromSummary.customer_name || "",
    customer_phone: cleaned.customer_phone || fromSummary.customer_phone || "",
    address: cleaned.address || fromSummary.address || "",
    neighborhood: cleaned.neighborhood || fromSummary.neighborhood || "",
    vehicle_type: cleaned.vehicle_type || fromSummary.vehicle_type || "",
    service_type: cleaned.service_type || fromSummary.service_type || "",
    preferred_date: cleaned.preferred_date || fromSummary.preferred_date || "",
    preferred_time: cleaned.preferred_time || fromSummary.preferred_time || "",
    payment_method: cleaned.payment_method || fromSummary.payment_method || "",
    notes: cleaned.notes || "",
  };

  // ─── Normalize each field
  const warnings: string[] = [];
  const normalizedDate = parseRelativeDate(merged.preferred_date);
  if (merged.preferred_date && !normalizedDate) warnings.push(`could_not_parse_date:${merged.preferred_date}`);

  const normalizedTime = parseTime(merged.preferred_time);
  if (merged.preferred_time && !normalizedTime) warnings.push(`could_not_parse_time:${merged.preferred_time}`);

  const service = parseService(merged.service_type);
  if (merged.service_type && !service) warnings.push(`unknown_service:${merged.service_type}`);

  const vehicleLabel = parseVehicle(merged.vehicle_type) || merged.vehicle_type || null;
  const paymentLabel = parsePayment(merged.payment_method) || merged.payment_method || null;
  const phoneE164 = merged.customer_phone ? normalizePhoneE164(merged.customer_phone) : "";

  const parsed = {
    customer_name: merged.customer_name || null,
    customer_phone: phoneE164 || null,
    address: merged.address || null,
    neighborhood: merged.neighborhood || null,
    vehicle_type: vehicleLabel,
    service_type: service?.name ?? merged.service_type ?? null,
    service_code: service?.code ?? null,
    preferred_date: normalizedDate,
    preferred_time: normalizedTime,
    payment_method: paymentLabel,
    payment_method_db: mapPaymentMethodToDb(paymentLabel),
    notes: merged.notes || null,
  };
  logStep("parsed_fields", parsed);

  // ─── Determine missing fields for a *real* booking
  const required: Array<keyof typeof parsed> = [
    "customer_phone", "customer_name", "address", "service_code",
    "preferred_date", "preferred_time",
  ];
  const missing: string[] = required.filter((k) => !parsed[k]);
  logStep("missing_fields", { missing });

  // ─── Common: insert booking_request when we cannot create a real booking
  const insertRequest = async (status: string, extra?: Record<string, unknown>) => {
    const { data: req, error } = await supabase
      .from("booking_requests")
      .insert({
        customer_name: parsed.customer_name,
        customer_phone: phoneE164 || null,
        address: parsed.address,
        neighborhood: parsed.neighborhood,
        vehicle_type: parsed.vehicle_type,
        service_type: parsed.service_type,
        preferred_date: parsed.preferred_date,
        preferred_time: parsed.preferred_time,
        payment_method: parsed.payment_method,
        notes: parsed.notes,
        status,
        source: "botmaker",
        channel: "whatsapp",
        botmaker_conversation_id: cleaned.conversation_id || null,
        communication_provider: "botmaker",
        is_test: false,
        parsed_data: parsed,
        missing_fields: missing,
        parsing_warnings: warnings,
        raw_payload: {
          original_payload: payload,
          cleaned_payload: cleaned,
          parsed_data: parsed,
          missing_fields: missing,
          parsing_warnings: warnings,
          ...extra,
        },
      })
      .select("id")
      .single();

    if (error) console.error("[botmaker-create-booking] booking_request insert error", error);
    else logStep("created_booking_request", { id: req?.id, status });

    if (req?.id) {
      await notifyOps(
        supabase,
        "Pedido de reserva desde WhatsApp",
        `${parsed.customer_name ?? "Sin nombre"} · ${phoneE164 || "sin teléfono"} · ${status}`,
        { request_id: req.id, parsed, missing },
      );
    }
    await logAttempt(supabase, {
      conversation_id: cleaned.conversation_id || null,
      customer_phone: phoneE164 || null,
      payload,
      normalized_payload: parsed,
      result_status: status,
      booking_request_id: req?.id ?? null,
      error: error?.message,
    });
    return req?.id ?? null;
  };

  // ─── If anything is missing or unparseable → needs_review
  if (missing.length > 0 || warnings.length > 0) {
    const requestId = await insertRequest("needs_review");
    return jsonResponse({
      ok: true,
      status: "needs_review",
      booking_id: null,
      booking_request_id: requestId,
      customer_message: FRIENDLY_ACK,
      admin_message: `Pedido en revisión. Faltantes: ${missing.join(", ") || "—"}. Avisos: ${warnings.join("; ") || "—"}.`,
      parsed,
      missing_fields: missing,
    });
  }

  // ─── Coverage
  const coverage = validateCoverage(parsed.address as string);
  if (!coverage.allowed) {
    const requestId = await insertRequest("needs_review", { coverage_reason: coverage.reason });
    return jsonResponse({
      ok: true,
      status: "needs_review",
      booking_id: null,
      booking_request_id: requestId,
      customer_message: FRIENDLY_ACK,
      admin_message: `Fuera de zona declarada: ${coverage.reason}`,
      parsed,
      missing_fields: [],
    });
  }

  // ─── Availability
  const avail = await validateAvailability(supabase, parsed.preferred_date as string, parsed.preferred_time as string);
  if (!avail.available) {
    await logAttempt(supabase, {
      conversation_id: cleaned.conversation_id || null,
      customer_phone: phoneE164,
      payload,
      normalized_payload: parsed,
      result_status: "slot_unavailable",
      error: avail.reason,
    });
    return jsonResponse({
      ok: false,
      status: "slot_unavailable",
      booking_id: null,
      booking_request_id: null,
      customer_message: FRIENDLY_SLOT_TAKEN,
      admin_message: avail.reason ?? "Slot unavailable",
      parsed,
      missing_fields: [],
    });
  }

  // ─── Duplicate
  const { data: dup } = await supabase
    .from("bookings")
    .select("id, booking_date, booking_time")
    .eq("customer_phone", phoneE164)
    .eq("booking_date", parsed.preferred_date)
    .eq("booking_time", parsed.preferred_time)
    .neq("status", "cancelled")
    .maybeSingle();

  if (dup) {
    logStep("duplicate_detected", { booking_id: dup.id });
    await logAttempt(supabase, {
      conversation_id: cleaned.conversation_id || null,
      customer_phone: phoneE164,
      payload,
      normalized_payload: parsed,
      result_status: "duplicate",
      booking_id: dup.id,
    });
    return jsonResponse({
      ok: true,
      status: "duplicate",
      booking_id: dup.id,
      booking_request_id: null,
      customer_message: FRIENDLY_DUPLICATE,
      admin_message: "Reserva duplicada detectada",
      parsed,
      missing_fields: [],
    });
  }

  // ─── Customer sync
  const { data: existingCust } = await supabase
    .from("customers")
    .select("id, full_name")
    .eq("phone_e164", phoneE164)
    .maybeSingle();

  let customerId: string | null = existingCust?.id ?? null;
  if (existingCust) {
    await supabase.from("customers").update({
      full_name: existingCust.full_name || parsed.customer_name,
      botmaker_conversation_id: cleaned.conversation_id || null,
      last_contact_channel: "whatsapp",
      communication_source: "botmaker",
      last_contact_at: new Date().toISOString(),
    }).eq("id", existingCust.id);
  } else {
    const { data: newCust } = await supabase.from("customers").insert({
      full_name: parsed.customer_name,
      phone_e164: phoneE164,
      botmaker_conversation_id: cleaned.conversation_id || null,
      last_contact_channel: "whatsapp",
      communication_source: "botmaker",
      last_contact_at: new Date().toISOString(),
    }).select("id").single();
    customerId = newCust?.id ?? null;
  }

  // ─── Pricing
  let basePriceCents = 0;
  const { data: pv } = await supabase
    .from("pricing_versions").select("id").eq("is_active", true)
    .order("version_number", { ascending: false }).limit(1).maybeSingle();
  const pricingVersionId = pv?.id ?? null;
  if (pricingVersionId) {
    const { data: items } = await supabase
      .from("pricing_items")
      .select("item_code, item_type, price_ars")
      .eq("pricing_version_id", pricingVersionId);
    const svc = items?.find((i: any) => i.item_type === "service" && i.item_code === parsed.service_code);
    if (svc) basePriceCents = Math.round(svc.price_ars * 100);
  }

  // ─── Create booking
  const { data: booking, error: bookingErr } = await supabase
    .from("bookings")
    .insert({
      customer_id: customerId,
      customer_name: parsed.customer_name,
      customer_email: cleaned.customer_email || "",
      customer_phone: phoneE164,
      service_name: service!.name,
      service_code: service!.code,
      service_price_cents: basePriceCents,
      base_price_ars: Math.round(basePriceCents / 100),
      total_price_ars: Math.round(basePriceCents / 100),
      final_price_ars: Math.round(basePriceCents / 100),
      vehicle_size: parsed.vehicle_type,
      car_type: parsed.vehicle_type,
      booking_date: parsed.preferred_date,
      booking_time: parsed.preferred_time,
      address: parsed.address,
      barrio: parsed.neighborhood,
      notes: parsed.notes,
      status: "pending",
      payment_status: "pending",
      payment_method: parsed.payment_method_db,
      requires_payment: parsed.payment_method_db !== "pay_later",
      booking_source: "botmaker",
      created_from: "botmaker",
      communication_channel: "whatsapp",
      botmaker_conversation_id: cleaned.conversation_id || null,
      pricing_version_id: pricingVersionId,
      whatsapp_opt_in: true,
      is_test: false,
    })
    .select("id, booking_date, booking_time")
    .single();

  if (bookingErr || !booking) {
    console.error("[botmaker-create-booking] booking insert error", bookingErr);
    const requestId = await insertRequest("needs_review", { booking_insert_error: bookingErr?.message });
    return jsonResponse({
      ok: false,
      status: "error",
      booking_id: null,
      booking_request_id: requestId,
      customer_message: FRIENDLY_ERROR,
      admin_message: bookingErr?.message ?? "Insert failed",
      parsed,
      missing_fields: [],
    });
  }

  logStep("created_booking", { id: booking.id });
  await logAttempt(supabase, {
    conversation_id: cleaned.conversation_id || null,
    customer_phone: phoneE164,
    payload,
    normalized_payload: parsed,
    result_status: "booking_created",
    booking_id: booking.id,
  });
  await notifyOps(
    supabase,
    "Nueva reserva desde WhatsApp 🚗",
    `${parsed.customer_name} · ${booking.booking_date} ${booking.booking_time} · ${service!.name}`,
    { booking_id: booking.id, parsed },
  );

  return jsonResponse({
    ok: true,
    status: "booking_created",
    booking_id: booking.id,
    booking_request_id: null,
    customer_message: FRIENDLY_CONFIRMED(booking.booking_date, booking.booking_time),
    admin_message: "Reserva creada correctamente",
    parsed,
    missing_fields: [],
  });
});
