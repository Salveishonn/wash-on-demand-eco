-- Create users table (phone-first identity)
CREATE TABLE public.users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone text UNIQUE NOT NULL,
  name text,
  email text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Public can upsert users (for booking flow)
CREATE POLICY "Anyone can insert users" ON public.users FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update users by phone" ON public.users FOR UPDATE USING (true);
CREATE POLICY "Admins can view all users" ON public.users FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Anyone can read their own user by phone" ON public.users FOR SELECT USING (true);

-- Create user_subscriptions table (new schema per user request)
CREATE TABLE public.user_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  plan_code text NOT NULL,
  washes_per_month integer NOT NULL,
  price_ars integer NOT NULL,
  status text NOT NULL DEFAULT 'active',
  start_date date NOT NULL DEFAULT CURRENT_DATE,
  next_billing_date date,
  payment_provider text,
  mp_preference_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.user_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can insert subscriptions" ON public.user_subscriptions FOR INSERT WITH CHECK (true);
CREATE POLICY "Admins can manage subscriptions" ON public.user_subscriptions FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Users can view their own subscriptions" ON public.user_subscriptions FOR SELECT USING (true);

-- Create user_bookings table (new schema per user request)
CREATE TABLE public.user_bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  subscription_id uuid REFERENCES public.user_subscriptions(id) ON DELETE SET NULL,
  service_code text NOT NULL,
  scheduled_at timestamptz NOT NULL,
  address_text text NOT NULL,
  neighborhood text,
  car_details jsonb,
  price_ars integer,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.user_bookings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can insert bookings" ON public.user_bookings FOR INSERT WITH CHECK (true);
CREATE POLICY "Admins can manage bookings" ON public.user_bookings FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Anyone can view bookings" ON public.user_bookings FOR SELECT USING (true);

-- Create indexes
CREATE INDEX idx_users_phone ON public.users(phone);
CREATE INDEX idx_user_subscriptions_user_id ON public.user_subscriptions(user_id);
CREATE INDEX idx_user_subscriptions_status ON public.user_subscriptions(status);
CREATE INDEX idx_user_bookings_user_id ON public.user_bookings(user_id);
CREATE INDEX idx_user_bookings_status ON public.user_bookings(status);
CREATE INDEX idx_user_bookings_scheduled_at ON public.user_bookings(scheduled_at);

-- Trigger for updated_at on users
CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger for updated_at on user_subscriptions
CREATE TRIGGER update_user_subscriptions_updated_at
  BEFORE UPDATE ON public.user_subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger for updated_at on user_bookings
CREATE TRIGGER update_user_bookings_updated_at
  BEFORE UPDATE ON public.user_bookings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();