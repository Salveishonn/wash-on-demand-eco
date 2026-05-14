
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS last_contact_at timestamptz;

ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS created_from text;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS botmaker_conversation_id text;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS communication_channel text;

ALTER TABLE public.booking_requests ADD COLUMN IF NOT EXISTS channel text DEFAULT 'whatsapp';

CREATE TABLE IF NOT EXISTS public.botmaker_booking_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id text,
  customer_phone text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  normalized_payload jsonb,
  result_status text NOT NULL,
  booking_id uuid,
  booking_request_id uuid,
  error text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.botmaker_booking_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view botmaker booking logs"
  ON public.botmaker_booking_logs FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Service role can insert botmaker booking logs"
  ON public.botmaker_booking_logs FOR INSERT
  WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_botmaker_booking_logs_created_at ON public.botmaker_booking_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bookings_booking_source_botmaker ON public.bookings(booking_source) WHERE booking_source = 'botmaker';
