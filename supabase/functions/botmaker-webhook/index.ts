// Botmaker webhook receiver — webhook-first integration path.
// Receives Botmaker events, validates auth-bm-token, persists events / messages
// / conversations, and runs the booking-detection parser so booking_requests
// are created EVEN IF the Botmaker Code Action never runs.

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
const TZ = "America/Argentina/Buenos_Aires";

// ──────────────────────────────────────────────────────────────────────────
// Utility helpers
// ──────────────────────────────────────────────────────────────────────────

function timingSafeEq(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let res = 0;
  for (let i = 0; i < a.length; i++) res |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return res === 0;
}

function maskSecret(value: string | null): string {
  if (!value) return "missing";
  if (value.length <= 8) return `${value.slice(0, 2)}***${value.slice(-2)}`;
  return `${value.slice(0, 4)}***${value.slice(-4)}`;
}

function logStep(step: string, data: Record<string, unknown> = {}) {
  try {
    console.log(`[botmaker-webhook] ${step}`, JSON.stringify(data));
  } catch {
    console.log(`[botmaker-webhook] ${step}`);
  }
}

function stripAccents(s: string): string {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

async function setDiagnostic(supabase: any, key: string, value_text?: string | null) {
  try {
    await supabase.from("botmaker_diagnostics").upsert(
      { key, value_text: value_text ?? null, value_at: new Date().toISOString(), updated_at: new Date().toISOString() },
      { onConflict: "key" },
    );
  } catch (e) {
    console.error("[botmaker-webhook] diagnostic upsert failed", e);
  }
}

// ──────────────────────────────────────────────────────────────────────────
// Payload extraction
// ──────────────────────────────────────────────────────────────────────────

type ExtractedMeta = {
  event_type: string;
  conversation_id: string | null;
  customer_phone: string | null;
  customer_name: string | null;
  channel: string | null;
  direction: "in" | "out" | "event";
  sender_type: "user" | "bot" | "agent" | "system";
  message_text: string | null;
  message_type: string;
  event_timestamp: string | null;
  botmaker_message_id: string | null;
};

function getPath(obj: any, path: string): unknown {
  return path.split(".").reduce((acc, part) => {
    if (acc == null) return undefined;
    const match = part.match(/^(\w+)\[(\d+)\]$/);
    if (match) return acc?.[match[1]]?.[Number(match[2])];
    return acc?.[part];
  }, obj);
}

function asString(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return null;
}

function firstString(obj: any, paths: string[]): string | null {
  for (const path of paths) {
    const value = asString(getPath(obj, path));
    if (value) return value;
  }
  return null;
}

function firstMessage(p: Record<string, any>): Record<string, any> | null {
  if (Array.isArray(p.messages) && p.messages.length > 0 && typeof p.messages[0] === "object") return p.messages[0];
  if (Array.isArray(p.data?.messages) && p.data.messages.length > 0 && typeof p.data.messages[0] === "object") return p.data.messages[0];
  if (typeof p.message === "object" && p.message) return p.message;
  if (typeof p.event?.message === "object" && p.event.message) return p.event.message;
  return null;
}

function pickEventId(p: Record<string, any>): string | null {
  return firstString(p, [
    "eventId", "event_id", "id", "messageId", "message_id",
    "messages[0]._id_", "messages[0].id", "messages[0].messageId",
    "data.messages[0]._id_", "event.message.id",
  ]);
}

function normalizePhoneLike(value: string | null): string | null {
  if (!value) return null;
  const digits = value.replace(/[^0-9]/g, "");
  return digits.length >= 8 ? digits : value;
}

function extractMeta(p: Record<string, any>): ExtractedMeta {
  const msg = firstMessage(p);
  const event_type = firstString(p, ["eventType", "event_type", "type"]) ?? "unknown";
  const conversation_id = firstString(p, [
    "customerId", "chatId", "chat.id", "conversationId", "conversation.id",
    "sessionId", "userId", "contactId", "conversation_id", "chat_id", "customer_id",
  ]);
  const customer_phone = normalizePhoneLike(firstString(p, [
    "realWhatsAppId", "whatsappId", "customer.phone", "contact.phone", "user.phone",
    "from", "sender", "phone", "customerPhone", "customer_phone", "contactId", "whatsappNumber",
  ]));
  const firstName = firstString(p, ["firstName"]);
  const lastName = firstString(p, ["lastName"]);
  const nameFromParts = [firstName, lastName].filter(Boolean).join(" ").trim() || null;
  const customer_name = firstString(p, [
    "fullName", "customer.name", "contact.name", "user.name", "name",
    "customerName", "customer_name", "contactName", "contact_name", "whatsappNickName",
    "messages[0].fromName", "data.messages[0].fromName",
  ]) ?? nameFromParts;
  const channel = firstString(p, ["channel", "chatPlatform", "platform", "chat.channel"])
    ?? (customer_phone ? "whatsapp" : firstString(p, ["webchatId", "webchat.id"]) ? "webchat" : null);

  const message_text = firstString(p, [
    "message", "text", "message.text", "content", "content.text", "body",
    "data.text", "data.message", "data.message.text", "data.messages[0].text",
    "data.messages[0].message", "messages[0].text", "messages[0].message",
    "event.message", "event.message.text", "event.text",
    "lastUserSentence", "lastBotSentence", "lastSentence",
  ]);
  const message_type = firstString(p, ["messageType", "message_type", "messages[0].type", "data.messages[0].type"]) ?? "text";
  const event_timestamp = firstString(p, [
    "timestamp", "ts", "created_at", "date", "messages[0].date", "data.messages[0].date",
    "event.timestamp", "statusChangeTime",
  ]);
  const botmaker_message_id = firstString(p, [
    "messageId", "message_id", "messages[0]._id_", "messages[0].id", "messages[0].messageId",
    "data.messages[0]._id_", "event.message.id",
  ]);

  const explicitDirection = String(p.direction ?? p.way ?? msg?.direction ?? "").toLowerCase();
  const fromValue = String(msg?.from ?? p.fromType ?? p.from_type ?? p.who ?? "").toLowerCase();
  const senderRaw = String(p.who ?? p.senderType ?? p.sender_type ?? p.sender ?? msg?.senderType ?? "").toLowerCase();
  const eventLower = event_type.toLowerCase();

  let direction: "in" | "out" | "event" = "in";
  if (eventLower.includes("status") || eventLower.includes("event") || message_type.toLowerCase() === "event") direction = "event";
  if (explicitDirection === "out" || explicitDirection === "outbound" || explicitDirection === "from-business") direction = "out";
  if (explicitDirection === "in" || explicitDirection === "inbound" || explicitDirection === "from-user") direction = "in";
  if (msg?.fromCustomer === true || fromValue === "user" || fromValue === "customer") direction = "in";
  if (msg?.fromCustomer === false || ["bot", "agent", "operator"].some((x) => fromValue.includes(x))) direction = "out";
  if (eventLower.includes("bot") || eventLower.includes("outbound")) direction = "out";

  let sender_type: "user" | "bot" | "agent" | "system" = direction === "out" ? "bot" : direction === "event" ? "system" : "user";
  const who = `${senderRaw} ${fromValue} ${eventLower}`;
  if (who.includes("agent") || who.includes("operator") || Boolean(msg?.operatorId)) sender_type = "agent";
  else if (who.includes("bot")) sender_type = "bot";
  else if (who.includes("system") || direction === "event") sender_type = "system";
  else if (msg?.fromCustomer === true || direction === "in") sender_type = "user";

  return {
    event_type, conversation_id, customer_phone, customer_name, channel,
    direction, sender_type, message_text, message_type, event_timestamp, botmaker_message_id,
  };
}

// ──────────────────────────────────────────────────────────────────────────
// Spanish booking-summary parser (kept inline to avoid shared-module deploys)
// ──────────────────────────────────────────────────────────────────────────

function nowInBA(): Date {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
  });
  const parts = Object.fromEntries(
    fmt.formatToParts(new Date()).filter((p) => p.type !== "literal").map((p) => [p.type, p.value]),
  ) as Record<string, string>;
  return new Date(`${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}`);
}

function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const WEEKDAYS: Record<string, number> = {
  domingo: 0, lunes: 1, martes: 2, miercoles: 3, jueves: 4, viernes: 5, sabado: 6,
};

function parseDate(input: string): string | null {
  if (!input) return null;
  const raw = input.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const slash = raw.match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?$/);
  if (slash) {
    const day = slash[1].padStart(2, "0");
    const month = slash[2].padStart(2, "0");
    const year = slash[3] ? (slash[3].length === 2 ? `20${slash[3]}` : slash[3]) : String(nowInBA().getFullYear());
    return `${year}-${month}-${day}`;
  }
  const lower = stripAccents(raw.toLowerCase());
  const today = nowInBA();
  if (lower === "hoy") return ymd(today);
  if (lower.includes("pasado manana")) { const d = new Date(today); d.setDate(d.getDate() + 2); return ymd(d); }
  if (lower.includes("manana")) { const d = new Date(today); d.setDate(d.getDate() + 1); return ymd(d); }
  for (const [name, target] of Object.entries(WEEKDAYS)) {
    if (lower.includes(name)) {
      const dow = today.getDay();
      let diff = target - dow;
      if (diff <= 0 || lower.includes("que viene") || lower.includes("proximo")) diff += 7;
      const d = new Date(today); d.setDate(d.getDate() + diff); return ymd(d);
    }
  }
  return null;
}

function parseTime(input: string): string | null {
  if (!input) return null;
  const lower = stripAccents(input.toLowerCase()).trim();
  const m = lower.match(/(\d{1,2})(?:[:.](\d{2}))?\s*(am|pm|hs|h)?/);
  if (!m) return null;
  let h = parseInt(m[1], 10);
  const min = m[2] ? parseInt(m[2], 10) : 0;
  const mer = m[3];
  if (mer === "pm" && h < 12) h += 12;
  if (mer === "am" && h === 12) h = 0;
  if (h < 0 || h > 23 || min < 0 || min > 59) return null;
  return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
}

function normService(s: string): string | null {
  const l = stripAccents((s || "").toLowerCase());
  if (l.includes("complet")) return "Lavado Completo";
  if (l.includes("basic")) return "Lavado Básico";
  return s || null;
}
function normVehicle(s: string): string | null {
  const l = stripAccents((s || "").toLowerCase());
  if (l.includes("suv")) return "SUV";
  if (l.includes("pick") || l.includes("camioneta")) return "Pick-up";
  if (l.includes("auto") || l.includes("sedan") || l.includes("hatch")) return "Auto";
  return s || null;
}
function normPayment(s: string): string | null {
  const l = stripAccents((s || "").toLowerCase());
  if (l.includes("mercado")) return "MercadoPago";
  if (l.includes("transfer")) return "Transferencia";
  if (l.includes("despue") || l.includes("efectivo")) return "Pagar después";
  return s || null;
}

const SUMMARY_MARKERS = [
  /perfecto,?\s*tengo\s+estos\s+datos/i,
  /confirm[aá]s\s+que\s+est[aá]\s+todo/i,
  /^\s*nombre\s+completo\s*[:\-]/im,
];

function isBookingSummary(text: string): boolean {
  if (!text || text.length < 30) return false;
  return SUMMARY_MARKERS.some((re) => re.test(text));
}

const CONFIRM_PATTERNS = /^\s*(s[ií]+|sisi|confirmo|confirmado|correcto|correcta|ok+|dale|joya|esta\s+bien|est[aá]\s+bien|perfecto|todo\s+bien|listo)\s*[!.]*\s*$/i;

function isConfirmation(text: string): boolean {
  if (!text) return false;
  const cleaned = stripAccents(text.trim().toLowerCase());
  return CONFIRM_PATTERNS.test(cleaned);
}

function parseSummary(text: string) {
  const out: Record<string, string> = {};
  const lines = text.replace(/\r/g, "").split("\n");
  const fields: Array<[RegExp, string]> = [
    [/^\s*nombre(?:\s+completo)?\s*[:\-]\s*(.+?)\s*$/i, "customer_name"],
    [/^\s*(?:direcci[oó]n|domicilio|calle)\s*[:\-]\s*(.+?)\s*$/i, "address"],
    [/^\s*(?:zona|barrio|localidad)\s*[:\-]\s*(.+?)\s*$/i, "neighborhood"],
    [/^\s*(?:veh[ií]culo|auto|coche)\s*[:\-]\s*(.+?)\s*$/i, "vehicle_type"],
    [/^\s*(?:servicio|lavado)\s*[:\-]\s*(.+?)\s*$/i, "service_type"],
    [/^\s*(?:d[ií]a|fecha)\s*[:\-]\s*(.+?)\s*$/i, "preferred_date"],
    [/^\s*(?:horario|hora)\s*[:\-]\s*(.+?)\s*$/i, "preferred_time"],
    [/^\s*pago\s*[:\-]\s*(.+?)\s*$/i, "payment_method"],
    [/^\s*tel[eé]fono\s*[:\-]\s*(.+?)\s*$/i, "customer_phone"],
  ];
  for (const line of lines) {
    for (const [re, key] of fields) {
      if (out[key]) continue;
      const m = line.match(re);
      if (m && m[1]) out[key] = m[1].trim();
    }
  }
  return out;
}

function buildParsed(rawSummary: Record<string, string>) {
  const warnings: string[] = [];
  const date = parseDate(rawSummary.preferred_date ?? "");
  if (rawSummary.preferred_date && !date) warnings.push(`could_not_parse_date:${rawSummary.preferred_date}`);
  const time = parseTime(rawSummary.preferred_time ?? "");
  if (rawSummary.preferred_time && !time) warnings.push(`could_not_parse_time:${rawSummary.preferred_time}`);

  const parsed = {
    customer_name: rawSummary.customer_name ?? null,
    customer_phone: rawSummary.customer_phone ?? null,
    address: rawSummary.address ?? null,
    neighborhood: rawSummary.neighborhood ?? null,
    vehicle_type: normVehicle(rawSummary.vehicle_type ?? ""),
    service_type: normService(rawSummary.service_type ?? ""),
    preferred_date: date,
    preferred_time: time,
    payment_method: normPayment(rawSummary.payment_method ?? ""),
  };

  const required = ["customer_name", "address", "service_type", "preferred_date", "preferred_time"];
  const missing = required.filter((k) => !(parsed as any)[k]);
  return { parsed, missing, warnings };
}

// ──────────────────────────────────────────────────────────────────────────
// Booking-request creation from webhook fallback path
// ──────────────────────────────────────────────────────────────────────────

async function tryCreateBookingRequestFromConversation(
  supabase: any,
  conversation_id: string,
  customer_phone: string | null,
  customer_name: string | null,
  triggerMessageBody: string | null,
) {
  if (!conversation_id) return { skipped: "no_conversation" };
  // Load last 15 messages of this conversation, oldest -> newest
  const { data: msgs } = await supabase
    .from("botmaker_messages")
    .select("id, direction, sender, body, message_text, created_at")
    .eq("conversation_id", conversation_id)
    .order("created_at", { ascending: false })
    .limit(15);
  if (!msgs || msgs.length === 0) return { skipped: "no_messages" };

  // Find latest bot summary message
  const summaryMsg = msgs.find((m: any) => m.direction !== "in" && isBookingSummary(m.body ?? m.message_text ?? ""));
  if (!summaryMsg) {
    logStep("no_summary_in_conversation", { conversation_id });
    return { skipped: "no_summary" };
  }
  // Trigger must be a confirmation
  if (!isConfirmation(triggerMessageBody ?? "")) {
    return { skipped: "not_confirmation" };
  }

  await setDiagnostic(supabase, "last_summary_detected", conversation_id);
  await setDiagnostic(supabase, "last_confirmation_detected", conversation_id);
  logStep("booking_summary_detected", { conversation_id });
  logStep("booking_confirmation_detected", { conversation_id });

  // Parse
  const summaryText = summaryMsg.body ?? summaryMsg.message_text ?? "";
  const raw = parseSummary(summaryText);
  const { parsed, missing, warnings } = buildParsed(raw);

  // Dedup: same conversation + same date/time within 10 minutes
  const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  const { data: existing } = await supabase
    .from("booking_requests")
    .select("id, preferred_date, preferred_time")
    .eq("botmaker_conversation_id", conversation_id)
    .gte("created_at", tenMinAgo)
    .limit(5);
  const dup = (existing ?? []).find((r: any) =>
    r.preferred_date === parsed.preferred_date && r.preferred_time === parsed.preferred_time,
  );
  if (dup) {
    logStep("duplicate_booking_request_skipped", { existing_id: dup.id });
    return { skipped: "duplicate", existing_id: dup.id };
  }

  const { data: req, error } = await supabase
    .from("booking_requests")
    .insert({
      customer_name: parsed.customer_name ?? customer_name,
      customer_phone: parsed.customer_phone ?? customer_phone,
      address: parsed.address,
      neighborhood: parsed.neighborhood,
      vehicle_type: parsed.vehicle_type,
      service_type: parsed.service_type,
      preferred_date: parsed.preferred_date,
      preferred_time: parsed.preferred_time,
      payment_method: parsed.payment_method,
      status: "needs_review",
      source: "botmaker",
      channel: "whatsapp",
      botmaker_conversation_id: conversation_id,
      communication_provider: "botmaker",
      is_test: false,
      parsed_data: parsed,
      missing_fields: missing,
      parsing_warnings: warnings,
      raw_payload: {
        origin: "webhook_parser",
        summary_message: summaryText,
        trigger_message: triggerMessageBody,
        last_messages: msgs,
      },
    })
    .select("id")
    .single();

  if (error) {
    logStep("booking_request_insert_failed", { error: error.message });
    return { error: error.message };
  }
  logStep("booking_request_created_from_webhook", { id: req?.id, missing });
  await setDiagnostic(supabase, "last_booking_request_created", req?.id ?? null);
  await setDiagnostic(supabase, "last_booking_request_created_from_webhook", req?.id ?? null);
  await supabase.from("botmaker_conversations").update({
    linked_booking_request_id: req?.id,
    updated_at: new Date().toISOString(),
  }).eq("conversation_id", conversation_id);
  return { created_id: req?.id, missing, warnings };
}

// ──────────────────────────────────────────────────────────────────────────
// Main handler
// ──────────────────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  if (req.method === "GET") {
    return new Response(JSON.stringify({
      ok: true,
      service: "botmaker-webhook",
      auth_bm_token_check: BOTMAKER_WEBHOOK_SECRET ? "enabled" : "disabled",
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "method_not_allowed" }), {
      status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const rawBody = await req.text();
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  logStep("webhook_received", { bytes: rawBody.length });

  // Auth
  const received = req.headers.get("auth-bm-token");
  logStep("auth_header_present", { present: Boolean(received) });
  const tokenOk = Boolean(BOTMAKER_WEBHOOK_SECRET) && Boolean(received) &&
    timingSafeEq(received!, BOTMAKER_WEBHOOK_SECRET);
  logStep("auth_check", {
    received: maskSecret(received), expected_configured: Boolean(BOTMAKER_WEBHOOK_SECRET), matches: tokenOk,
  });

  if (!tokenOk) {
    logStep("auth_invalid", { header_present: Boolean(received), expected_configured: Boolean(BOTMAKER_WEBHOOK_SECRET) });
    let invalidPayload: Record<string, any> = {};
    try { invalidPayload = rawBody ? JSON.parse(rawBody) : {}; } catch { invalidPayload = { raw_body: rawBody.slice(0, 2000) }; }
    await supabase.from("botmaker_events").insert({
      event_type: "signature_invalid",
      payload: { reason: "Invalid or missing auth-bm-token", ...invalidPayload },
      raw_payload: { reason: "Invalid or missing auth-bm-token", ...invalidPayload },
      auth_valid: false,
      processed: true,
      processing_error: "invalid_auth_bm_token",
    });
    await setDiagnostic(supabase, "last_invalid_webhook", "token_mismatch");
    await setDiagnostic(supabase, "last_token_mismatch", maskSecret(received));
    return new Response(JSON.stringify({ error: "invalid_auth_bm_token" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  logStep("auth_valid", { header_present: Boolean(received) });

  let payload: Record<string, any>;
  try {
    payload = rawBody ? JSON.parse(rawBody) : {};
  } catch {
    return new Response(JSON.stringify({ error: "invalid_json" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  await setDiagnostic(supabase, "last_valid_webhook", payload?.eventType ?? payload?.type ?? "unknown");

  logStep("extraction_started");
  const meta = extractMeta(payload);
  const event_id = pickEventId(payload);
  logStep("extraction_success", {
    event_id, event_type: meta.event_type, conversation_id: meta.conversation_id,
    has_phone: Boolean(meta.customer_phone), direction: meta.direction, sender_type: meta.sender_type,
    has_text: Boolean(meta.message_text),
  });
  await Promise.all([
    setDiagnostic(supabase, "last_event_raw_type", meta.event_type),
    setDiagnostic(supabase, "last_event_channel", meta.channel),
    setDiagnostic(supabase, "last_event_sender_type", meta.sender_type),
    setDiagnostic(supabase, "last_event_text_extracted", meta.message_text ? meta.message_text.slice(0, 240) : "—"),
    setDiagnostic(supabase, "last_conversation_id_extracted", meta.conversation_id),
    setDiagnostic(supabase, "last_phone_extracted", meta.customer_phone),
  ]);

  // Idempotency
  if (event_id) {
    const { data: existing } = await supabase
      .from("botmaker_events").select("id").eq("event_id", event_id).maybeSingle();
    if (existing) {
      logStep("duplicate_event", { event_id });
      return new Response(JSON.stringify({ ok: true, duplicate: true, id: existing.id }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  }

  // Insert event
  const { data: insertedEvent, error: evtErr } = await supabase
    .from("botmaker_events").insert({
      event_id, event_type: meta.event_type, channel: meta.channel,
      conversation_id: meta.conversation_id, customer_phone: meta.customer_phone,
      customer_name: meta.customer_name, sender_type: meta.sender_type,
      message_text: meta.message_text, auth_valid: true,
      payload, raw_payload: payload, processed: true,
    }).select("id").single();
  if (evtErr) {
    logStep("event_insert_failed", { error: evtErr.message });
    return new Response(JSON.stringify({ error: "insert_failed" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  logStep("raw_payload_saved", { id: insertedEvent.id });
  await setDiagnostic(supabase, "last_stored_botmaker_event_id", insertedEvent.id);

  // Conversation + message + customer (best-effort)
  let bookingResult: any = null;
  try {
    if (meta.conversation_id) {
      const preview = typeof meta.message_text === "string" ? meta.message_text.slice(0, 140) : null;
      let storedMessageId: string | null = null;

      if (typeof meta.message_text === "string" && meta.message_text.trim()) {
        const safeTimestamp = meta.event_timestamp ? new Date(meta.event_timestamp) : null;
        const { data: storedMsg, error: msgErr } = await supabase.from("botmaker_messages").insert({
          conversation_id: meta.conversation_id,
          botmaker_message_id: meta.botmaker_message_id,
          direction: meta.direction,
          sender: meta.customer_name ?? meta.customer_phone ?? meta.sender_type,
          sender_type: meta.sender_type,
          body: meta.message_text.slice(0, 4000),
          message_text: meta.message_text.slice(0, 4000),
          message_type: meta.message_type,
          customer_phone: meta.customer_phone,
          customer_name: meta.customer_name,
          channel: meta.channel ?? "whatsapp",
          event_timestamp: safeTimestamp && !Number.isNaN(safeTimestamp.getTime()) ? safeTimestamp.toISOString() : null,
          raw: payload,
          raw_payload: payload,
          provider_message_id: event_id,
        }).select("id").single();
        if (msgErr) logStep("message_insert_failed", { error: msgErr.message });
        else {
          storedMessageId = storedMsg?.id ?? null;
          logStep("message_inserted", { id: storedMessageId });
          await setDiagnostic(supabase, "last_stored_botmaker_message_id", storedMessageId);
        }
      } else {
        logStep("no_message_text_found", { conversation_id: meta.conversation_id, event_type: meta.event_type });
      }

      // Conversation upsert
      const { data: convExisting } = await supabase
        .from("botmaker_conversations").select("id").eq("conversation_id", meta.conversation_id).maybeSingle();
      if (convExisting) {
        await supabase.from("botmaker_conversations").update({
          customer_phone: meta.customer_phone ?? undefined,
          customer_name: meta.customer_name ?? undefined,
          last_message_at: new Date().toISOString(),
          last_message: preview ?? undefined,
          last_message_preview: preview ?? undefined,
          last_direction: meta.direction,
          last_sender_type: meta.sender_type,
          channel: meta.channel ?? "whatsapp",
          raw_payload: payload,
          updated_at: new Date().toISOString(),
        }).eq("id", convExisting.id);
      } else {
        await supabase.from("botmaker_conversations").insert({
          conversation_id: meta.conversation_id,
          botmaker_conversation_id: meta.conversation_id,
          customer_phone: meta.customer_phone,
          customer_name: meta.customer_name,
          channel: meta.channel ?? "whatsapp",
          last_message_at: new Date().toISOString(),
          last_message: preview,
          last_message_preview: preview,
          last_direction: meta.direction,
          last_sender_type: meta.sender_type,
          raw_payload: payload,
        });
      }
      logStep("conversation_upserted", { conversation_id: meta.conversation_id, stored_message_id: storedMessageId });
      await setDiagnostic(supabase, "last_conversation_stored", meta.conversation_id);

      // Customer upsert
      if (meta.customer_phone) {
        const { data: cust } = await supabase
          .from("customers").select("id").eq("phone_e164", meta.customer_phone).maybeSingle();
        if (!cust) {
          await supabase.from("customers").insert({
            full_name: meta.customer_name ?? "Sin nombre",
            phone_e164: meta.customer_phone,
            botmaker_conversation_id: meta.conversation_id,
            last_contact_channel: meta.channel ?? "whatsapp",
            communication_source: "botmaker",
            last_contact_at: new Date().toISOString(),
          });
        } else {
          await supabase.from("customers").update({
            last_contact_at: new Date().toISOString(),
            last_contact_channel: meta.channel ?? "whatsapp",
            communication_source: "botmaker",
            botmaker_conversation_id: meta.conversation_id ?? undefined,
          }).eq("id", cust.id);
        }
      }

      // ── Booking-detection fallback parser
      // Only on inbound user messages with text
      if (meta.direction === "in" && typeof meta.message_text === "string" && meta.message_text.trim()) {
        bookingResult = await tryCreateBookingRequestFromConversation(
          supabase, meta.conversation_id, meta.customer_phone, meta.customer_name, meta.message_text,
        );
      }
    }
  } catch (e) {
    logStep("error", { stage: "post_processing", message: (e as Error).message });
  }

  return new Response(JSON.stringify({ ok: true, id: insertedEvent.id, booking: bookingResult }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
