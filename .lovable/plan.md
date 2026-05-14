# Botmaker Integration — Webhook-First Overhaul

Make Botmaker work without depending on the Code Action. Primary path = global webhook parser; Code Action stays as optional future path.

## 1. Database migration

Extend existing tables (already created last turn) and add booking-detection state:

- `botmaker_messages`: add `message_type text`, `timestamp timestamptz`, ensure `provider_message_id` unique-by-conversation.
- `botmaker_conversations`: add `last_sender_type text`, `last_event_at timestamptz`.
- `booking_requests`: ensure indexes on `(botmaker_conversation_id, created_at)` for dedup.
- New table `botmaker_diagnostics` (single-row key/value) for tracking last events: `last_valid_webhook_at`, `last_invalid_webhook_at`, `last_summary_detected_at`, `last_confirmation_at`, `last_booking_request_at`, `last_conversation_at`. Admin-readable.
- Helper SQL function: none needed — use upserts.

## 2. `botmaker-webhook/index.ts` rewrite (primary path)

Keep current auth-bm-token validation + idempotency. Add:

- **Robust extraction**: phone from `realWhatsAppId | from | phone | customerId`; name from `fullName | name | customerName | contactName`; conversation_id from `chatId | conversationId | customerId`; direction from explicit field or sender type heuristic; `sender_type` (`user` / `bot` / `agent` / `system`) from `who | senderType | from.role`; message_text from `text | message | body | lastUserSentence | lastBotSentence`.
- **Persist** event → `botmaker_events`, message → `botmaker_messages`, conversation upsert → `botmaker_conversations` with `last_sender_type`, `customer` upsert by phone (already exists — keep).
- **Booking-detection parser**: when an inbound user message arrives, look up the last 10 messages of that conversation. Detect last bot message containing `Perfecto, tengo estos datos` / labeled fields (`Nombre completo:`, `Dirección:`, `Zona:`, `Vehículo:`, `Servicio:`, `Día:`, `Horario:`, `Pago:`). If user message matches confirmation set (`sí|si|sisi|confirmo|correcto|ok|dale|joya|está bien|perfecto|confirmado`), parse the summary.
- **Spanish/Rioplatense parser** (`parseBookingSummary(text)`): regex per labeled line; date normalization (`mañana`, `pasado mañana`, `<weekday> que viene`, ISO) in `America/Argentina/Buenos_Aires`; time normalization (`16 hs`, `16hs`, `4 pm`, `a las 11`); vehicle/service/payment normalization. Returns `{parsed, missing_fields, parsing_warnings}`.
- **Dedup**: skip insert if a `booking_request` exists with same `botmaker_conversation_id`, same `preferred_date`/`preferred_time`, created in last 10 minutes.
- **Insert** `booking_request` with `status='needs_review'`, `source='botmaker'`, `communication_provider='botmaker'`, `channel='whatsapp'`, `parsed_data`, `missing_fields`, `parsing_warnings`, full `raw_payload` (last messages context + summary + confirmation).
- **Update `botmaker_diagnostics`** at each major event.
- **Structured logs** at every step (received / auth / extraction / detection / dedup / created / errors).
- Always return 200 quickly; do parser work inline (cheap) before returning.

## 3. Cleanup placeholder rows

One-off SQL via migration: `UPDATE booking_requests SET is_test=true WHERE customer_name ~ '\\{\\{|\\$\\{' OR address ~ '\\{\\{|\\$\\{' OR service_type ~ '\\{\\{|\\$\\{'`.

## 4. Admin UI

### `BotmakerMessagesTab.tsx`
- Already reads `botmaker_conversations` / `botmaker_messages` — no change needed once data flows in. Add empty-state diagnostic message with link to diagnostics panel ("No Botmaker events received yet…").
- Show linked booking_request / booking when present.

### `BotmakerTab.tsx`
- Add **Diagnostics panel** at top showing: webhook URL, expected header, secret-present badge, timestamps from `botmaker_diagnostics`, plus three buttons:
  1. "Test webhook without token" — fetch from browser, expect 401.
  2. "Test webhook with token" — admin-only, calls new edge function `botmaker-test-webhook` that uses server-side secret.
  3. "Simulate summary + confirmation" — calls existing `botmaker-simulate-event` (extend if needed) to inject 2 messages and trigger the parser.
- Add columns for parsed data + missing fields on each request row.
- Add row actions: **Aprobar y crear reserva** (already wired), **Pedir más datos**, **Rechazar (con motivo)**, **Marcar test/real**, **Ver raw payload** (modal with original / cleaned / parsed / warnings).
- Default filter: hide `is_test=true` and rows whose name/address contain `{{` or `${`. Toggle "Mostrar pedidos test".
- "Reservas desde WhatsApp" section: query `bookings` where `booking_source='botmaker' OR communication_channel='whatsapp' OR created_from='botmaker'`.
- Updated docs block: explain webhook-first model, warn against `{{...}}` in Code Action, link to Botmaker.

## 5. New / extended edge functions

- `botmaker-test-webhook` (admin-only, JWT + has_role): server-side curls own webhook with secret; returns status. No secret leaks.
- Extend `botmaker-simulate-event` to insert a bot summary message + user "sí" message into `botmaker_messages` for a synthetic conversation, then trigger booking_request creation with `is_test=true`.
- `botmaker-update-request` (admin-only): updates status to `waiting_customer` / `rejected` (with reason) / toggle `is_test`. Used by row actions.

## 6. Webchat injection

`BotmakerWebchat.tsx` already correct — no change.

## 7. Out of scope

Lovable Cloud migration; website booking; calendar; payments/MP; driver/ops; deletion of legacy WhatsApp inbox (kept as legacy view).

## Files touched

- 1 migration (schema + cleanup)
- `supabase/functions/botmaker-webhook/index.ts` (major rewrite of detection logic, keep auth)
- `supabase/functions/botmaker-simulate-event/index.ts` (extend)
- `supabase/functions/botmaker-test-webhook/index.ts` (new)
- `supabase/functions/botmaker-update-request/index.ts` (new)
- `src/components/admin/BotmakerTab.tsx` (diagnostics + actions + filters + WA bookings)
- `src/components/admin/BotmakerMessagesTab.tsx` (empty-state diagnostic)

Estimated ~1500 lines.
