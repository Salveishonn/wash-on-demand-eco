
-- Botmaker integration foundation tables

-- Raw inbound events from Botmaker (idempotent on event_id)
CREATE TABLE public.botmaker_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id text UNIQUE,
  event_type text NOT NULL,
  channel text,
  conversation_id text,
  customer_phone text,
  customer_name text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  processed boolean NOT NULL DEFAULT false,
  processing_error text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_botmaker_events_created_at ON public.botmaker_events (created_at DESC);
CREATE INDEX idx_botmaker_events_conversation ON public.botmaker_events (conversation_id);
CREATE INDEX idx_botmaker_events_phone ON public.botmaker_events (customer_phone);

ALTER TABLE public.botmaker_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view botmaker events"
  ON public.botmaker_events FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Service role can insert botmaker events"
  ON public.botmaker_events FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Service role can update botmaker events"
  ON public.botmaker_events FOR UPDATE
  USING (true);

-- Booking requests (drafts collected by Botmaker that may need review)
CREATE TABLE public.booking_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid,
  customer_name text,
  customer_phone text,
  customer_email text,
  address text,
  neighborhood text,
  vehicle_type text,
  service_type text,
  preferred_date date,
  preferred_time text,
  notes text,
  status text NOT NULL DEFAULT 'needs_review',
  source text NOT NULL DEFAULT 'botmaker',
  botmaker_conversation_id text,
  resulting_booking_id uuid,
  raw_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_booking_requests_status ON public.booking_requests (status);
CREATE INDEX idx_booking_requests_created_at ON public.booking_requests (created_at DESC);

ALTER TABLE public.booking_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage booking requests"
  ON public.booking_requests FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Service role can insert booking requests"
  ON public.booking_requests FOR INSERT
  WITH CHECK (true);

CREATE TRIGGER update_booking_requests_updated_at
  BEFORE UPDATE ON public.booking_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Communication logs (every outbound provider call)
CREATE TABLE public.communication_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL,
  event_type text NOT NULL,
  customer_phone text,
  booking_id uuid,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  provider_response jsonb,
  status text NOT NULL DEFAULT 'pending',
  error text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_communication_logs_created_at ON public.communication_logs (created_at DESC);
CREATE INDEX idx_communication_logs_booking ON public.communication_logs (booking_id);

ALTER TABLE public.communication_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view communication logs"
  ON public.communication_logs FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Service role can insert communication logs"
  ON public.communication_logs FOR INSERT
  WITH CHECK (true);

-- Extend customers with Botmaker fields
ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS botmaker_conversation_id text,
  ADD COLUMN IF NOT EXISTS botmaker_contact_id text,
  ADD COLUMN IF NOT EXISTS communication_source text,
  ADD COLUMN IF NOT EXISTS last_contact_channel text;
