# Botmaker Integration — Phased Plan

This is a large, multi-week integration. To keep it safe (booking, admin, driver, payments must keep working), I'll ship it in **independent phases**, each verifiable on its own. I won't do all 13 phases in one shot — that would risk breaking production. Below is the sequencing, with what ships per milestone.

---

## Status of what already exists

- **Phase 1 (Webchat on public site)** — already implemented and verified. `BotmakerWebchat.tsx` exists, excludes `/admin`, `/ops`, `/driver`, `/login`, `/auth`, `/payment`, `/mercadopago`, dedups script, and CSP allows Botmaker + storage.googleapis.com. Bubble confirmed visible on `/`.
  - **Note**: your message contains a typo — `0OFW1NYUKE` (zero-O). The working ID is `O0FW1NYUKE` (capital-O, zero), already in code. Confirm if you actually want it changed.
- A direct Meta WhatsApp integration is live (templates, outbox pattern, audio transcoder, etc.) and must stay working as the fallback.

---

## Proposed milestones (each = one approval + ship cycle)

### Milestone A — Foundations (no behavior change)
1. Add secrets: `BOTMAKER_API_TOKEN`, `BOTMAKER_WEBHOOK_SECRET`, `BOTMAKER_CHANNEL_ID`, `BOTMAKER_BASE_URL`, `COMMUNICATION_PROVIDER` (default `meta_direct` until A is green).
2. DB migration:
   - `botmaker_events` (raw inbound, idempotent on `event_id`)
   - `booking_requests` (Botmaker-collected drafts: `needs_review | ready_to_book | booking_created | cancelled | duplicate`)
   - `communication_logs` (provider, event_type, payload, response, status)
   - Add `botmaker_conversation_id`, `botmaker_contact_id`, `communication_source`, `last_contact_channel` to `customers`.
3. Edge function `botmaker-webhook` — verify signature, persist raw event, dedupe, return 200. No business logic yet.
4. Admin → "Botmaker / Comunicaciones" tab (read-only): connection status, last event, last error, current provider, recent events.

### Milestone B — Provider abstraction (dual-write off)
1. `supabase/functions/_shared/communication/index.ts` exposing `sendCustomerMessage({ phone, templateName, variables, messageType, bookingId, customerId })`.
2. Adapters: `metaAdapter.ts` (wraps current `whatsapp-send` logic) + `botmakerAdapter.ts` (new).
3. Reads `COMMUNICATION_PROVIDER`. All existing call sites for outbound operational messages refactored to go through this single entry point.
4. Logs every send to `communication_logs`. Guarantees **no duplicate** (only one provider per send).
5. Keep default = `meta_direct` so production behavior is unchanged. Flip to `botmaker` per environment when ready.

### Milestone C — Inbound sync from Botmaker
1. `botmaker-webhook` processor: customer upsert by phone (no duplicates), conversation/channel tracking, internal `operator_notifications` for new conversation / human handoff.
2. Edge function `botmaker-create-booking-request`:
   - Validates fields. If date/time fully valid + slot available → real booking via existing `create-booking` domain logic (status `pending`).
   - Otherwise → `booking_requests` row with `needs_review`.
   - Notifies admin + ops PWA via existing `notify-event` / push pipeline.
3. Admin UI: "Botmaker leads" + "Booking requests" cards with action buttons (convert to booking, mark duplicate, dismiss).

### Milestone D — Outbound events through Botmaker
Wire all 9 lifecycle events (`booking_created`, `booking_accepted`, `booking_rescheduled`, `worker_on_the_way`, `worker_arrived`, `booking_completed`, `payment_pending`, `subscription_purchased`, `subscription_wash_scheduled`) through the provider adapter. Map each to a Botmaker template/flow. Verify exactly-one-send.

### Milestone E — Diagnostics, content, cleanup
1. `/admin/botmaker-diagnostics` page running the full checklist (webchat present on public, absent on admin, secrets set, webhook reachable, test inbound, test outbound, booking request, notification, log).
2. Store the 6 menu copy blocks in `app_settings` (keys `botmaker_menu_*`) so you can paste/edit from admin and we have one source of truth.
3. Mark legacy direct Meta paths as "fallback only" in admin UI; add the "Comunicación vía Botmaker activa" banner when provider = botmaker.

---

## What I will NOT do
- Rebuild WhatsApp UI inside Washero. Botmaker owns the inbox; we keep summary metadata + a deep-link.
- Delete Meta direct integration. It stays as documented fallback.
- Touch booking, pricing, admin, driver, payments, or availability logic except via the new adapter and the new tables.

---

## Open questions before I start Milestone A

1. **Channel ID typo** — confirm webchat ID is `O0FW1NYUKE` (current, working) and the `0OFW1NYUKE` in your message was a typo.
2. **Botmaker API specifics** — do you have:
   - Botmaker REST API base URL for your tenant (e.g. `https://go.botmaker.com/api/v1.0`)?
   - The API token / "Business Token"?
   - The webhook signing scheme (HMAC header name)? Botmaker's docs vary by plan.
   I need these to build the adapter + webhook signature check correctly. I'll request them via the secrets tool when you approve Milestone A.
3. **Template mapping** — for Milestone D, do you already have approved Botmaker templates matching the 9 events, or should I propose names + variables and you create them in Botmaker?
4. **Order of milestones** — OK to ship A → B → C → D → E in separate approvals, or do you want a different priority (e.g. C first because you want inbound leads ASAP)?

Reply with answers (or just "proceed with A, defaults") and I'll start Milestone A.
