-- Create availability_rules table (weekly defaults)
CREATE TABLE public.availability_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  weekday integer NOT NULL CHECK (weekday >= 0 AND weekday <= 6),
  is_open boolean NOT NULL DEFAULT true,
  start_time text NOT NULL DEFAULT '08:00',
  end_time text NOT NULL DEFAULT '17:00',
  slot_interval_minutes integer NOT NULL DEFAULT 60,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(weekday)
);

-- Create availability_overrides table (per date exceptions)
CREATE TABLE public.availability_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  date date NOT NULL UNIQUE,
  is_closed boolean NOT NULL DEFAULT false,
  note text,
  surcharge_amount integer, -- ARS cents
  surcharge_percent numeric,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Create availability_override_slots table (per date + time slot exceptions)
CREATE TABLE public.availability_override_slots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  date date NOT NULL,
  time text NOT NULL,
  is_open boolean NOT NULL DEFAULT true,
  UNIQUE(date, time)
);

-- Add indexes
CREATE INDEX idx_availability_overrides_date ON public.availability_overrides(date);
CREATE INDEX idx_availability_override_slots_date ON public.availability_override_slots(date);
CREATE INDEX idx_availability_override_slots_date_time ON public.availability_override_slots(date, time);

-- Enable RLS
ALTER TABLE public.availability_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.availability_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.availability_override_slots ENABLE ROW LEVEL SECURITY;

-- RLS Policies for availability_rules (admin only)
CREATE POLICY "Admins can view availability rules"
  ON public.availability_rules FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can insert availability rules"
  ON public.availability_rules FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update availability rules"
  ON public.availability_rules FOR UPDATE
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete availability rules"
  ON public.availability_rules FOR DELETE
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Public read for availability rules (for booking calendar)
CREATE POLICY "Anyone can view availability rules"
  ON public.availability_rules FOR SELECT
  USING (true);

-- RLS Policies for availability_overrides (admin only for write, public read)
CREATE POLICY "Anyone can view availability overrides"
  ON public.availability_overrides FOR SELECT
  USING (true);

CREATE POLICY "Admins can insert availability overrides"
  ON public.availability_overrides FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update availability overrides"
  ON public.availability_overrides FOR UPDATE
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete availability overrides"
  ON public.availability_overrides FOR DELETE
  USING (has_role(auth.uid(), 'admin'::app_role));

-- RLS Policies for availability_override_slots (admin only for write, public read)
CREATE POLICY "Anyone can view availability override slots"
  ON public.availability_override_slots FOR SELECT
  USING (true);

CREATE POLICY "Admins can insert availability override slots"
  ON public.availability_override_slots FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update availability override slots"
  ON public.availability_override_slots FOR UPDATE
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete availability override slots"
  ON public.availability_override_slots FOR DELETE
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Insert default weekly rules (CORRECT SCHEDULE)
-- Sunday (0): CLOSED
INSERT INTO public.availability_rules (weekday, is_open, start_time, end_time, slot_interval_minutes)
VALUES (0, false, '08:00', '12:00', 60);

-- Monday (1): 08:00-17:00
INSERT INTO public.availability_rules (weekday, is_open, start_time, end_time, slot_interval_minutes)
VALUES (1, true, '08:00', '17:00', 60);

-- Tuesday (2): 08:00-17:00
INSERT INTO public.availability_rules (weekday, is_open, start_time, end_time, slot_interval_minutes)
VALUES (2, true, '08:00', '17:00', 60);

-- Wednesday (3): 08:00-17:00
INSERT INTO public.availability_rules (weekday, is_open, start_time, end_time, slot_interval_minutes)
VALUES (3, true, '08:00', '17:00', 60);

-- Thursday (4): 08:00-17:00
INSERT INTO public.availability_rules (weekday, is_open, start_time, end_time, slot_interval_minutes)
VALUES (4, true, '08:00', '17:00', 60);

-- Friday (5): 08:00-17:00
INSERT INTO public.availability_rules (weekday, is_open, start_time, end_time, slot_interval_minutes)
VALUES (5, true, '08:00', '17:00', 60);

-- Saturday (6): 08:00-12:00
INSERT INTO public.availability_rules (weekday, is_open, start_time, end_time, slot_interval_minutes)
VALUES (6, true, '08:00', '12:00', 60);