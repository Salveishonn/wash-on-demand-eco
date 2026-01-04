-- Create cars table for user vehicles
CREATE TABLE IF NOT EXISTS public.cars (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nickname text,
  plate text,
  brand text,
  model text,
  color text,
  is_default boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create addresses table for user addresses
CREATE TABLE IF NOT EXISTS public.addresses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  label text DEFAULT 'Casa',
  line1 text NOT NULL,
  line2 text,
  city text,
  neighborhood text,
  notes text,
  is_default boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create user_managed_subscriptions table (separate from existing guest subscriptions)
CREATE TABLE IF NOT EXISTS public.user_managed_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_id text NOT NULL CHECK (plan_id IN ('basic', 'confort', 'premium')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('active', 'paused', 'canceled', 'pending')),
  start_date date DEFAULT CURRENT_DATE,
  next_wash_at timestamptz,
  pause_until timestamptz,
  default_address_id uuid REFERENCES public.addresses(id),
  default_car_id uuid REFERENCES public.cars(id),
  washes_remaining integer DEFAULT 0,
  washes_used_this_month integer DEFAULT 0,
  payment_status text DEFAULT 'unknown' CHECK (payment_status IN ('unpaid', 'paid', 'past_due', 'unknown')),
  payment_provider text DEFAULT 'mercadopago',
  payment_reference text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS on all new tables
ALTER TABLE public.cars ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.addresses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_managed_subscriptions ENABLE ROW LEVEL SECURITY;

-- RLS for cars: users can only access their own cars
CREATE POLICY "Users can view their own cars"
  ON public.cars FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own cars"
  ON public.cars FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own cars"
  ON public.cars FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own cars"
  ON public.cars FOR DELETE
  USING (auth.uid() = user_id);

-- RLS for addresses: users can only access their own addresses
CREATE POLICY "Users can view their own addresses"
  ON public.addresses FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own addresses"
  ON public.addresses FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own addresses"
  ON public.addresses FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own addresses"
  ON public.addresses FOR DELETE
  USING (auth.uid() = user_id);

-- RLS for user_managed_subscriptions: users can only access their own subscriptions
CREATE POLICY "Users can view their own subscriptions"
  ON public.user_managed_subscriptions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own subscriptions"
  ON public.user_managed_subscriptions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own subscriptions"
  ON public.user_managed_subscriptions FOR UPDATE
  USING (auth.uid() = user_id);

-- Admins can manage all subscriptions
CREATE POLICY "Admins can manage all subscriptions"
  ON public.user_managed_subscriptions FOR ALL
  USING (has_role(auth.uid(), 'admin'));

-- Update timestamps trigger for new tables
CREATE TRIGGER update_cars_updated_at
  BEFORE UPDATE ON public.cars
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_addresses_updated_at
  BEFORE UPDATE ON public.addresses
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_user_managed_subscriptions_updated_at
  BEFORE UPDATE ON public.user_managed_subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Update subscription_plans with correct prices (55000, 95000, 125000 in cents)
UPDATE public.subscription_plans 
SET price_cents = 5500000, washes_per_month = 2, name = 'Plan Básico', description = '2 lavados por mes'
WHERE name ILIKE '%básico%' OR name ILIKE '%basico%';

UPDATE public.subscription_plans 
SET price_cents = 9500000, washes_per_month = 4, name = 'Plan Confort', description = '4 lavados por mes (1 por semana)'
WHERE name ILIKE '%confort%';

UPDATE public.subscription_plans 
SET price_cents = 12500000, washes_per_month = 4, name = 'Plan Premium', description = '4 lavados por mes + encerado'
WHERE name ILIKE '%premium%';