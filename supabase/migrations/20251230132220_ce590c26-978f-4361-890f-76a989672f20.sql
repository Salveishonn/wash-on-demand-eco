-- ============================================================
-- META WHATSAPP CLOUD API INTEGRATION - DATABASE SCHEMA
-- ============================================================

-- A) Create customers table for tracking WhatsApp opt-in
CREATE TABLE IF NOT EXISTS public.customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name text NOT NULL,
  email text,
  phone_e164 text UNIQUE NOT NULL,
  whatsapp_opt_in boolean DEFAULT false,
  whatsapp_opt_in_at timestamptz,
  whatsapp_last_message_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

-- RLS Policies for customers
CREATE POLICY "Admins can manage customers"
ON public.customers
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Anyone can upsert customers during booking"
ON public.customers
FOR INSERT
WITH CHECK (true);

CREATE POLICY "Anyone can update their own customer record by phone"
ON public.customers
FOR UPDATE
USING (true);

-- B) Extend bookings table with customer_id and WhatsApp tracking
DO $$
BEGIN
  -- Add customer_id column if not exists
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'bookings' AND column_name = 'customer_id') THEN
    ALTER TABLE public.bookings ADD COLUMN customer_id uuid REFERENCES public.customers(id);
  END IF;
  
  -- Add whatsapp_opt_in column if not exists
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'bookings' AND column_name = 'whatsapp_opt_in') THEN
    ALTER TABLE public.bookings ADD COLUMN whatsapp_opt_in boolean DEFAULT false;
  END IF;
  
  -- Add whatsapp_message_status column if not exists
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'bookings' AND column_name = 'whatsapp_message_status') THEN
    ALTER TABLE public.bookings ADD COLUMN whatsapp_message_status text DEFAULT 'none' CHECK (whatsapp_message_status IN ('none', 'queued', 'sent', 'failed'));
  END IF;
  
  -- Add whatsapp_last_message_type column if not exists
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'bookings' AND column_name = 'whatsapp_last_message_type') THEN
    ALTER TABLE public.bookings ADD COLUMN whatsapp_last_message_type text;
  END IF;
  
  -- Add whatsapp_last_error column if not exists
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'bookings' AND column_name = 'whatsapp_last_error') THEN
    ALTER TABLE public.bookings ADD COLUMN whatsapp_last_error text;
  END IF;
END $$;

-- C) Extend subscriptions table with customer_id and WhatsApp tracking
DO $$
BEGIN
  -- Add customer_id column if not exists
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'subscriptions' AND column_name = 'customer_id') THEN
    ALTER TABLE public.subscriptions ADD COLUMN customer_id uuid REFERENCES public.customers(id);
  END IF;
  
  -- Add whatsapp_message_status column if not exists
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'subscriptions' AND column_name = 'whatsapp_message_status') THEN
    ALTER TABLE public.subscriptions ADD COLUMN whatsapp_message_status text DEFAULT 'none' CHECK (whatsapp_message_status IN ('none', 'queued', 'sent', 'failed'));
  END IF;
  
  -- Add whatsapp_last_message_type column if not exists
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'subscriptions' AND column_name = 'whatsapp_last_message_type') THEN
    ALTER TABLE public.subscriptions ADD COLUMN whatsapp_last_message_type text;
  END IF;
  
  -- Add whatsapp_last_error column if not exists
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'subscriptions' AND column_name = 'whatsapp_last_error') THEN
    ALTER TABLE public.subscriptions ADD COLUMN whatsapp_last_error text;
  END IF;
END $$;

-- D) Create whatsapp_outbox table for reliable delivery + retries
CREATE TABLE IF NOT EXISTS public.whatsapp_outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type text NOT NULL CHECK (entity_type IN ('reservation', 'subscription', 'manual')),
  entity_id uuid,
  customer_id uuid REFERENCES public.customers(id),
  to_phone_e164 text NOT NULL,
  template_name text NOT NULL,
  language_code text DEFAULT 'es_AR',
  template_vars jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text DEFAULT 'queued' CHECK (status IN ('queued', 'sent', 'failed', 'retry')),
  attempts int DEFAULT 0,
  last_error text,
  next_retry_at timestamptz,
  sent_at timestamptz,
  wa_message_id text,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.whatsapp_outbox ENABLE ROW LEVEL SECURITY;

-- RLS Policies for whatsapp_outbox
CREATE POLICY "Admins can manage whatsapp_outbox"
ON public.whatsapp_outbox
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- E) Create whatsapp_templates table for approved templates
CREATE TABLE IF NOT EXISTS public.whatsapp_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  description text,
  parameter_count int DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.whatsapp_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage whatsapp_templates"
ON public.whatsapp_templates
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Anyone can view active whatsapp_templates"
ON public.whatsapp_templates
FOR SELECT
USING (is_active = true);

-- Insert default templates
INSERT INTO public.whatsapp_templates (name, description, parameter_count)
VALUES 
  ('washero_booking_confirmed', 'Confirmación de reserva: fecha, hora, dirección, servicio', 4),
  ('washero_subscription_active', 'Activación de suscripción: plan, lavados, link', 3),
  ('washero_on_the_way', 'En camino: ETA en minutos', 1),
  ('washero_service_completed', 'Servicio completado: link para reservar', 1)
ON CONFLICT (name) DO NOTHING;

-- Create index on whatsapp_outbox for efficient processing
CREATE INDEX IF NOT EXISTS idx_whatsapp_outbox_status ON public.whatsapp_outbox(status) WHERE status IN ('queued', 'retry');
CREATE INDEX IF NOT EXISTS idx_whatsapp_outbox_next_retry ON public.whatsapp_outbox(next_retry_at) WHERE status = 'retry';

-- Create index on customers for phone lookup
CREATE INDEX IF NOT EXISTS idx_customers_phone ON public.customers(phone_e164);

-- Update calendar_bookings_v view to include whatsapp_opt_in
DROP VIEW IF EXISTS public.calendar_bookings_v;
CREATE VIEW public.calendar_bookings_v AS
SELECT 
  b.id,
  b.booking_date,
  b.booking_time,
  b.customer_name,
  b.customer_phone,
  b.customer_email,
  b.address,
  b.service_name,
  b.car_type,
  b.service_price_cents,
  b.car_type_extra_cents,
  b.addons,
  b.addons_total_cents,
  b.total_cents,
  b.status AS booking_status,
  b.payment_status,
  b.payment_method,
  b.subscription_id,
  b.is_subscription_booking,
  b.notes,
  b.created_at,
  b.confirmed_at,
  b.booking_source,
  b.whatsapp_opt_in,
  b.customer_id
FROM public.bookings b
ORDER BY b.booking_date, b.booking_time;