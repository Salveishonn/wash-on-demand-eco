-- Add metadata columns for messages
ALTER TABLE public.botmaker_messages
  ADD COLUMN IF NOT EXISTS message_type text,
  ADD COLUMN IF NOT EXISTS event_timestamp timestamptz;

-- Add tracking columns for conversations
ALTER TABLE public.botmaker_conversations
  ADD COLUMN IF NOT EXISTS last_sender_type text;

-- Index for dedup
CREATE INDEX IF NOT EXISTS idx_booking_requests_conv_created
  ON public.booking_requests (botmaker_conversation_id, created_at DESC);

-- Diagnostics table (single-row key/value)
CREATE TABLE IF NOT EXISTS public.botmaker_diagnostics (
  key text PRIMARY KEY,
  value_text text,
  value_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.botmaker_diagnostics ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can read diagnostics" ON public.botmaker_diagnostics;
CREATE POLICY "Admins can read diagnostics"
  ON public.botmaker_diagnostics FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Service role manages diagnostics insert" ON public.botmaker_diagnostics;
CREATE POLICY "Service role manages diagnostics insert"
  ON public.botmaker_diagnostics FOR INSERT
  WITH CHECK (true);

DROP POLICY IF EXISTS "Service role manages diagnostics update" ON public.botmaker_diagnostics;
CREATE POLICY "Service role manages diagnostics update"
  ON public.botmaker_diagnostics FOR UPDATE
  USING (true);

-- Cleanup placeholder rows (mark as test, do not delete)
UPDATE public.booking_requests
SET is_test = true
WHERE
  (customer_name ~ '\{\{|\$\{')
  OR (address ~ '\{\{|\$\{')
  OR (service_type ~ '\{\{|\$\{')
  OR (neighborhood ~ '\{\{|\$\{')
  OR (vehicle_type ~ '\{\{|\$\{');
