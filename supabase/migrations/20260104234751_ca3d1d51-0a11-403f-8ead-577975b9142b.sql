-- Create pricing_versions table
CREATE TABLE public.pricing_versions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  version_number integer NOT NULL,
  is_active boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  activated_at timestamp with time zone,
  notes text
);

-- Create pricing_items table
CREATE TABLE public.pricing_items (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  pricing_version_id uuid NOT NULL REFERENCES public.pricing_versions(id) ON DELETE CASCADE,
  item_type text NOT NULL CHECK (item_type IN ('service', 'vehicle_extra', 'extra', 'plan')),
  item_code text NOT NULL,
  display_name text NOT NULL,
  price_ars integer NOT NULL DEFAULT 0,
  metadata jsonb DEFAULT '{}'::jsonb,
  sort_order integer DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Create unique constraint for item per version
CREATE UNIQUE INDEX pricing_items_version_type_code_idx 
ON public.pricing_items(pricing_version_id, item_type, item_code);

-- Enable RLS
ALTER TABLE public.pricing_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pricing_items ENABLE ROW LEVEL SECURITY;

-- RLS policies for pricing_versions
CREATE POLICY "Anyone can view active pricing versions"
ON public.pricing_versions FOR SELECT
USING (is_active = true);

CREATE POLICY "Admins can manage pricing versions"
ON public.pricing_versions FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- RLS policies for pricing_items
CREATE POLICY "Anyone can view pricing items of active versions"
ON public.pricing_items FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.pricing_versions pv 
    WHERE pv.id = pricing_version_id AND pv.is_active = true
  )
);

CREATE POLICY "Admins can manage pricing items"
ON public.pricing_items FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Insert initial pricing version
INSERT INTO public.pricing_versions (id, version_number, is_active, activated_at, notes)
VALUES ('00000000-0000-0000-0000-000000000001', 1, true, now(), 'Initial pricing version');

-- Insert services
INSERT INTO public.pricing_items (pricing_version_id, item_type, item_code, display_name, price_ars, metadata, sort_order) VALUES
('00000000-0000-0000-0000-000000000001', 'service', 'basic', 'Lavado Básico', 30000, '{"duration_min": 45, "description": "Exterior + Interior básico"}'::jsonb, 1),
('00000000-0000-0000-0000-000000000001', 'service', 'complete', 'Lavado Completo', 38000, '{"duration_min": 60, "description": "Exterior + Interior completo"}'::jsonb, 2);

-- Insert vehicle extras
INSERT INTO public.pricing_items (pricing_version_id, item_type, item_code, display_name, price_ars, metadata, sort_order) VALUES
('00000000-0000-0000-0000-000000000001', 'vehicle_extra', 'small', 'Auto chico', 0, '{}'::jsonb, 1),
('00000000-0000-0000-0000-000000000001', 'vehicle_extra', 'suv', 'SUV / Crossover', 5000, '{}'::jsonb, 2),
('00000000-0000-0000-0000-000000000001', 'vehicle_extra', 'pickup', 'Pick Up / Van', 8000, '{}'::jsonb, 3);

-- Insert extras
INSERT INTO public.pricing_items (pricing_version_id, item_type, item_code, display_name, price_ars, metadata, sort_order) VALUES
('00000000-0000-0000-0000-000000000001', 'extra', 'wax', 'Encerado rápido', 8000, '{"icon": "Sparkles"}'::jsonb, 1),
('00000000-0000-0000-0000-000000000001', 'extra', 'deep_interior', 'Detallado interior profundo', 9000, '{"icon": "Armchair"}'::jsonb, 2),
('00000000-0000-0000-0000-000000000001', 'extra', 'odors', 'Eliminación de olores', 12000, '{"icon": "Wind"}'::jsonb, 3),
('00000000-0000-0000-0000-000000000001', 'extra', 'mud', 'Barro / Auto muy sucio', 7000, '{"icon": "Waves"}'::jsonb, 4);

-- Insert plans
INSERT INTO public.pricing_items (pricing_version_id, item_type, item_code, display_name, price_ars, metadata, sort_order) VALUES
('00000000-0000-0000-0000-000000000001', 'plan', 'basic', 'Plan Básico', 55000, '{"washes_per_month": 2, "included_service": "basic", "included_vehicle_size": "small"}'::jsonb, 1),
('00000000-0000-0000-0000-000000000001', 'plan', 'confort', 'Plan Confort', 95000, '{"washes_per_month": 4, "included_service": "complete", "included_vehicle_size": "small"}'::jsonb, 2),
('00000000-0000-0000-0000-000000000001', 'plan', 'premium', 'Plan Premium', 125000, '{"washes_per_month": 8, "included_service": "complete", "included_vehicle_size": "suv"}'::jsonb, 3);

-- Add new columns to bookings table
ALTER TABLE public.bookings 
ADD COLUMN IF NOT EXISTS booking_type text DEFAULT 'single' CHECK (booking_type IN ('single', 'subscription')),
ADD COLUMN IF NOT EXISTS service_code text,
ADD COLUMN IF NOT EXISTS vehicle_size text,
ADD COLUMN IF NOT EXISTS pricing_version_id uuid REFERENCES public.pricing_versions(id),
ADD COLUMN IF NOT EXISTS base_price_ars integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS vehicle_extra_ars integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS extras_total_ars integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_price_ars integer DEFAULT 0;

-- Add columns to subscriptions table
ALTER TABLE public.subscriptions
ADD COLUMN IF NOT EXISTS plan_code text,
ADD COLUMN IF NOT EXISTS included_service text,
ADD COLUMN IF NOT EXISTS included_vehicle_size text,
ADD COLUMN IF NOT EXISTS pricing_version_id uuid REFERENCES public.pricing_versions(id);