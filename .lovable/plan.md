## Botmaker → Washero Direct Booking Integration

Build the bridge so the Botmaker WhatsApp chatbot can create real bookings in Washero's backend, reusing existing booking domain logic.

### 1. Database migration

Add columns and tables:

- `customers`: add `last_contact_at timestamptz` (other fields like `botmaker_conversation_id`, `botmaker_contact_id`, `communication_source`, `last_contact_channel` already exist).
- `bookings`: add `created_from text` (already has `booking_source`; we'll mirror to `created_from` for the new endpoint), `botmaker_conversation_id text`, `communication_channel text`.
- `booking_requests`: already exists with all needed columns; just confirm and add `channel text default 'whatsapp'` if missing.
- New table `botmaker_booking_logs` (id, conversation_id, customer_phone, payload jsonb, normalized_payload jsonb, result_status, booking_id, booking_request_id, error, created_at). RLS: admins read, service role insert.
- New table `botmaker_outbound_messages` is NOT needed — we'll reuse `outgoing_messages` / `communication_logs`.

### 2. New Edge Function: `botmaker-create-booking`

`supabase/functions/botmaker-create-booking/index.ts`:

- Validate `auth-bm-token` header against `BOTMAKER_WEBHOOK_SECRET`. Return 401 if invalid.
- Parse + zod-validate payload.
- Required: `customer_phone`, `customer_name`, `address`, `preferred_date`, `preferred_time`, `service_type`. Return `missing_data` with specific fields.
- Normalize phone via existing `_shared/phoneUtils.ts`.
- Customer sync: lookup by `phone_e164` in `customers`; insert or update with botmaker fields and `last_contact_at = now()`.
- Service mapping: map free-text `service_type` (e.g. "Lavado Básico", "Lavado Completo") to canonical `service_code`. If unmapped → `needs_review`.
- Date/time parsing: handle "YYYY-MM-DD" and "HH:mm". On failure → `needs_review`.
- Availability validation: reuse `validateAvailability()` from `_shared/bookingDomain.ts`. Reuse `validateCoverage()` for address.
- Pricing: reuse `calculateBookingFinancials()` so price is server-derived from active pricing version.
- Duplicate check: query bookings with same `customer_phone + booking_date + booking_time` not cancelled.
- If all good → insert into `bookings` with status pending, `booking_source='botmaker'`, `payment_status='pending'`, `payment_method` mapped (mercadopago/transferencia/pagar_despues), conversation id stored.
- Otherwise insert into `booking_requests` with appropriate status.
- Always log to `botmaker_booking_logs`.
- Create `operator_notifications` row ("Nueva reserva desde WhatsApp 🚗" or "Nuevo pedido de reserva desde Botmaker").
- Return JSON per spec.

Register function in `supabase/config.toml` with `verify_jwt = false`.

### 3. Admin UI updates

`src/components/admin/BotmakerTab.tsx`:

- New "Reservas desde WhatsApp" section showing recent bookings where `booking_source='botmaker'` and recent `booking_requests`.
- Each request row: status badge, customer, phone, address, date/time, service, conversation id, created_at.
- Buttons on `booking_requests` rows: "Convertir en reserva" (calls a small admin action that retries the create flow), "Marcar como resuelto".
- New "Simular reserva desde Botmaker" diagnostic button — POSTs fake payload with the secret via the webhook, then refreshes list.
- "Ver últimos logs de reservas Botmaker" — shows last 20 rows from `botmaker_booking_logs`.

For "Convertir en reserva" reuse the same edge function via a small admin-only convert endpoint, or call `botmaker-create-booking` with the stored `raw_payload` and an admin override header. Simpler: add a second tiny edge function `botmaker-convert-request` that takes `{request_id}`, requires admin JWT (via `getClaims` + `has_role`), and runs the same internal flow.

### 4. Botmaker flow documentation

Append a "Flow de reserva por WhatsApp" card in `BotmakerTab.tsx` with copy-pasteable:

- Ordered list of 9 questions (text + variable name).
- Final HTTP call config (URL, headers, JSON body using `{{variable}}` syntax).
- Response handling map: `booking_created` / `needs_review` / `slot_unavailable` / `missing_data` / `duplicate`.

### 5. Verify

- Deploy function, run health-check style POST with valid token + complete payload → expect `booking_created`.
- POST with missing fields → `missing_data`.
- POST with invalid date → `needs_review`.
- Confirm row appears in `bookings`, `botmaker_booking_logs`, `operator_notifications`, and the admin Reservas / Calendario tabs (no UI change needed there since they read from `bookings`).

### Out of scope

- Outbound Botmaker confirmation API calls (Phase 11) — Botmaker shows the API response inline; we log only. We will NOT send a duplicate WhatsApp message from Washero for these bookings; existing notification queue paths skip when `booking_source='botmaker'` is present (we'll add a guard).
- Fleet lead intent (Phase 8 mention) — separate intent, not part of booking endpoint.

### Technical notes

- All prices server-derived; client cannot override.
- Service-type free-text mapping table kept inline in the function (basic/completo + synonyms); unknown → `needs_review`.
- Phone normalization: strip non-digits, ensure AR country code `+54`.
- Idempotency: same `conversation_id + preferred_date + preferred_time + phone` within 5 min → return existing booking response instead of duplicating.

Ready to implement on approval.
