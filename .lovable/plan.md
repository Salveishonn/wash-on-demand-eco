## Scope

Comprehensive Botmaker hardening + Admin Mensajes rebuild. Touches 1 webhook, 1 booking endpoint, several admin UI components, 1 migration, and docs. Web booking flow, payments, calendar, driver/admin auth, and Lovable Cloud config will NOT be modified.

## 1. Database migration

- `booking_requests`: add `payment_method text`, ensure `is_test boolean default false` exists (already does), add `parsed_data jsonb`, `missing_fields text[]`, `parsing_warnings text[]`, `communication_provider text default 'botmaker'`, `reviewed_at timestamptz`, `review_reason text`.
- `botmaker_events`: add `communication_provider text default 'botmaker'`.
- New table `botmaker_conversations` (id, conversation_id unique, customer_phone, customer_name, last_message_at, last_message_preview, last_direction, unread_count, linked_customer_id, linked_booking_request_id, linked_booking_id, channel, created_at, updated_at). Admin SELECT, service-role write.
- New table `botmaker_messages` (id, conversation_id, direction in/out/event, sender, body, raw jsonb, created_at, provider_message_id). Admin SELECT, service-role insert.
- Index on `botmaker_events(created_at desc)`, `botmaker_messages(conversation_id, created_at desc)`.
- Constraint helper: `booking_requests.status` allowed values extended with `approved`, `converted`, `waiting_customer`, `rejected` (validation trigger, not CHECK, per memory rule).

## 2. `botmaker-create-booking/index.ts` rewrite

- `cleanValue()` helper that strips `{{...}}`, `${...}`, `"undefined"`, `"null"`.
- Accept both structured payload and `ai_booking_summary` payload.
- Spanish/Rioplatense parser for relative dates (mañana, pasado mañana, "lunes que viene", etc.) using `America/Argentina/Buenos_Aires`, times ("10 am", "a las 11"), service ("básico/completo"), vehicle ("auto/suv/pick up/camioneta"), payment ("mercadopago/transferencia/pagar después").
- Always returns quickly with `{ ok, status, booking_id, booking_request_id, customer_message, admin_message, parsed, missing_fields }`.
- Customer-facing message is always friendly Spanish — never technical missing-field text.
- Auth: `auth-bm-token` header; on failure return `unauthorized` JSON (still 200 to avoid Botmaker retries hanging the user, but `ok:false`).
- Insert `booking_request` with cleaned + parsed payload + diagnostics in `raw_payload`.
- If complete + valid + slot available + coverage OK → create real `booking` (reuse existing `_shared/bookingDomain.ts` validators and pricing).
- Idempotency: same conversation_id + phone + date + time within 5 min → return prior booking.
- Structured logs at every step.

## 3. Remove hardcoded test data from production

- Audit `botmaker-create-booking-simulate` (ok), `BotmakerTab.tsx`, `botmaker-simulate-event` — ensure ALL hardcoded test values live only in simulate endpoints and always set `is_test = true` on inserted rows.
- Production `botmaker-create-booking` never inserts test fallbacks.

## 4. Admin → Botmaker / Comunicaciones (`BotmakerTab.tsx`)

- Show all `booking_requests` fields per row including parsed/missing/raw summary.
- "Mostrar pedidos test" toggle (default off — filters `is_test`).
- Per-row actions:
  - **Aprobar y crear reserva** → modal with editable fields → calls new `botmaker-convert-request` edge function (admin-auth via `getClaims` + `has_role`) which validates coverage/availability, creates booking, links and updates request to `converted`.
  - **Pedir más datos** → updates status to `waiting_customer`, optional `review_reason`, logs to `communication_logs`.
  - **Rechazar** → modal with required reason → status `rejected`.
  - **Marcar como test/real** → toggles `is_test`.
  - **Ver raw payload** → dialog with original/cleaned/parsed/missing JSON.
- "Reservas desde WhatsApp" section: query `bookings` where `booking_source='botmaker'` OR `created_from='botmaker'` OR `communication_channel='whatsapp'`. Show date, time, customer, address, status, link to calendar.
- Updated Code Action snippet using `${customerId}`, `${realWhatsAppId}`, `${fullName}`, `${lastBotSentence}` — with prominent warning against `{{...}}` syntax.
- Updated flow documentation: only "A) Reservar lavado" connects to the Code Action; AI Reservation Agent system prompt as specified.
- Latest 20 entries from `botmaker_booking_logs` and `botmaker_events` (cleanly separated: valid events vs `signature_invalid`).

## 5. New edge function `botmaker-convert-request`

- Admin-only (`getClaims` JWT verify + `has_role('admin')` via service role).
- Input: `{ request_id, overrides: {...editable fields} }`.
- Loads request, applies overrides, runs same domain validation as `botmaker-create-booking`, creates `booking`, links `booking_request.resulting_booking_id`, sets status `converted`, returns booking.

## 6. Admin → Mensajes rebuild (`MessagesTab.tsx`)

- Rename header to **"Mensajes / Botmaker"**.
- Left: conversation list from `botmaker_conversations` ordered by `last_message_at desc`, with name/phone/preview/unread badge and channel chip.
- Right: detail pane reading `botmaker_messages` for selected conversation. Inbound/outbound/event styling. Shows linked `booking_request`/`booking` cards with deep links.
- Reply box:
  - If `BOTMAKER_API_TOKEN` env present (checked via small `botmaker-config-check` edge function returning `{ canSendFromAdmin: true/false, fallbackChatUrl }`) → text input that POSTs to new `botmaker-send-message` edge function (admin auth) which calls Botmaker API and logs to `botmaker_messages` and `communication_logs`.
  - Else → CTA "Responder en Botmaker" linking to Botmaker conversation URL if known.
- Filter chip: include legacy Meta messages (read-only, labeled "Legacy WhatsApp integration") — pulled from existing `whatsapp_messages` / `outgoing_messages` table if present.

## 7. `botmaker-webhook/index.ts` updates

- Keep auth check + masked diagnostic logging (already done).
- After insert into `botmaker_events`, also:
  - Upsert `botmaker_conversations` by `conversation_id` (update last_message_at/preview/direction).
  - Insert into `botmaker_messages`.
  - Upsert `customers` by `phone_e164` when phone available.
- Invalid-token rows: tag `event_type='signature_invalid'` (already done) — UI filters them out from main feed.

## 8. New edge functions added

- `botmaker-convert-request` (admin)
- `botmaker-send-message` (admin, gated on `BOTMAKER_API_TOKEN`)
- `botmaker-config-check` (admin, returns capability flags only)

All three: JWT verify via `getClaims`, then `has_role('admin')` with service-role client.

## 9. Webchat injection

- `BotmakerWebchat.tsx` already does this correctly with excluded prefixes — verify, no functional change needed.

## 10. Logging

- Structured `console.log("[botmaker-create-booking]", { step, ...data })` at: request_received, auth_valid/invalid, raw_payload_received, placeholders_removed, parsed_fields, missing_fields, created_booking_request, created_booking, duplicate_detected, error.
- Same pattern for webhook.

## Out of scope

- Migrating Lovable Cloud (explicitly forbidden).
- Replacing/altering web booking, calendar, payment, MP, driver/ops, existing booking RLS.
- Deleting legacy WhatsApp data — only labeled in UI.
- Botmaker AI agent prompt changes (those live in Botmaker Builder, only docs in Admin updated).

## Order of implementation

1. Migration (schema + new tables).
2. Wait for approval; types regenerate.
3. Edge functions: `botmaker-create-booking` rewrite, `botmaker-webhook` extension, `botmaker-convert-request`, `botmaker-send-message`, `botmaker-config-check`.
4. Admin UI: `BotmakerTab.tsx` rebuild, `MessagesTab.tsx` rebuild.
5. Verify via curl_edge_functions on simulate path.

Estimated ~8 file changes + 1 migration + 3 new edge functions + 1 rewritten edge function. ~1500–2000 lines.

Ready to implement on approval.
