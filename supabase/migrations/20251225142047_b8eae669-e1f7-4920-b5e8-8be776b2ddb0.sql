-- Create service_addons table for additional services
CREATE TABLE public.service_addons (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  price_cents INTEGER NOT NULL DEFAULT 0,
  description TEXT,
  icon TEXT DEFAULT 'Sparkles',
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.service_addons ENABLE ROW LEVEL SECURITY;

-- Anyone can read active addons
CREATE POLICY "Anyone can view active service addons"
ON public.service_addons
FOR SELECT
USING (is_active = true);

-- Admins can manage addons
CREATE POLICY "Admins can manage service addons"
ON public.service_addons
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Seed initial addons (prices in cents)
INSERT INTO public.service_addons (name, price_cents, description, icon, sort_order) VALUES
  ('Sellador de Pintura', 1500000, 'Protección extra para la pintura de tu vehículo', 'Droplet', 1),
  ('Pelo de Mascotas', 1000000, 'Limpieza profunda para remover pelos de mascotas', 'Wind', 2),
  ('Limpieza de Motor', 1800000, 'Desengrasado y limpieza completa del motor', 'Cog', 3),
  ('Eliminación de Olores', 1200000, 'Tratamiento para eliminar malos olores', 'Leaf', 4);

-- Add addons columns to bookings table
ALTER TABLE public.bookings
ADD COLUMN IF NOT EXISTS addons JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS addons_total_cents INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_cents INTEGER GENERATED ALWAYS AS (service_price_cents + COALESCE(car_type_extra_cents, 0) + COALESCE(addons_total_cents, 0)) STORED;

-- Update calendar_bookings_v view to include addons
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
  (b.service_price_cents + COALESCE(b.car_type_extra_cents, 0) + COALESCE(b.addons_total_cents, 0)) AS total_cents,
  b.status AS booking_status,
  b.payment_status,
  b.payment_method,
  b.subscription_id,
  b.is_subscription_booking,
  b.notes,
  b.created_at,
  b.confirmed_at
FROM public.bookings b
WHERE 
  b.status IN ('confirmed', 'completed')
  AND (
    b.payment_status = 'approved'
    OR b.is_subscription_booking = true
    OR (b.payment_status = 'pending' AND b.payment_method IN ('cash', 'pay_later'))
  );