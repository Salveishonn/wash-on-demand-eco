
-- Phase 4: App settings table
CREATE TABLE public.app_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text UNIQUE NOT NULL,
  value text NOT NULL,
  type text NOT NULL DEFAULT 'string',
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage app settings" ON public.app_settings
  FOR ALL TO public USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Anyone can read app settings" ON public.app_settings
  FOR SELECT TO public USING (true);

-- Seed initial settings from hardcoded values
INSERT INTO public.app_settings (key, value, type, description) VALUES
  ('LAUNCH_DATE', '2026-04-15', 'string', 'First date bookings are allowed (YYYY-MM-DD)'),
  ('FOUNDER_DISCOUNT_PERCENT', '20', 'number', 'Discount for founding launch slots'),
  ('FOUNDING_SLOTS_TOTAL', '30', 'number', 'Number of founding launch slots'),
  ('BARRIO_DISCOUNT_PERCENT', '30', 'number', 'Barrio coordination discount percent'),
  ('BARRIO_THRESHOLD', '3', 'number', 'Minimum bookings for barrio discount'),
  ('BOOKING_ENABLED', 'true', 'boolean', 'Whether booking is currently enabled'),
  ('CLUSTER_PRICING_ENABLED', 'true', 'boolean', 'Whether cluster pricing engine is active');

-- Phase 7: Job execution events
CREATE TABLE public.booking_execution_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  worker_id uuid REFERENCES auth.users(id),
  event_type text NOT NULL,
  notes text,
  photo_url text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.booking_execution_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage execution events" ON public.booking_execution_events
  FOR ALL TO public USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Service role can insert execution events" ON public.booking_execution_events
  FOR INSERT TO public WITH CHECK (true);

-- Phase 8: System events bus
CREATE TABLE public.system_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text NOT NULL,
  entity_id text,
  payload jsonb DEFAULT '{}'::jsonb,
  processed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.system_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view system events" ON public.system_events
  FOR SELECT TO public USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Service role can insert system events" ON public.system_events
  FOR INSERT TO public WITH CHECK (true);

-- Index for efficient querying
CREATE INDEX idx_system_events_type_created ON public.system_events(event_type, created_at DESC);
CREATE INDEX idx_system_events_unprocessed ON public.system_events(processed) WHERE processed = false;
CREATE INDEX idx_booking_execution_events_booking ON public.booking_execution_events(booking_id);
CREATE INDEX idx_app_settings_key ON public.app_settings(key);
