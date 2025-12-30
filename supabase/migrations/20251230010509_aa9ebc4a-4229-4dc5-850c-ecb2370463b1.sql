-- Update subscription plans with new pricing
-- First, deactivate old plans
UPDATE public.subscription_plans SET is_active = false;

-- Insert new plans with correct pricing
INSERT INTO public.subscription_plans (name, description, price_cents, washes_per_month, is_active)
VALUES 
  ('Plan Básico', '2 lavados por mes - Exterior + interior', 4500000, 2, true),
  ('Plan Confort', '4 lavados por mes (1 por semana) - Exterior + interior - Prioridad en agenda', 8500000, 4, true),
  ('Plan Premium', '4 lavados por mes - Incluye encerado rápido (1 vez por mes) y detallado interior liviano - Máxima prioridad', 11000000, 4, true);

-- Update existing addons and add new ones
-- First deactivate all, then reactivate/insert what we need
UPDATE public.service_addons SET is_active = false;

-- Encerado rápido - new
INSERT INTO public.service_addons (name, description, price_cents, icon, is_active, sort_order)
VALUES ('Encerado Rápido', 'Protección y brillo para la pintura', 800000, 'Sparkles', true, 1)
ON CONFLICT DO NOTHING;

-- Detallado interior - new
INSERT INTO public.service_addons (name, description, price_cents, icon, is_active, sort_order)
VALUES ('Detallado Interior', 'Limpieza profunda de tapizados y superficies', 900000, 'Sofa', true, 2)
ON CONFLICT DO NOTHING;

-- Pelo de Mascotas - reactivate existing
UPDATE public.service_addons SET is_active = true, sort_order = 3 WHERE name = 'Pelo de Mascotas';

-- Eliminación de Olores - reactivate existing
UPDATE public.service_addons SET is_active = true, sort_order = 4 WHERE name = 'Eliminación de Olores';