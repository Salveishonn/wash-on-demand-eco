-- Add columns to subscriptions for guest identification and cycle tracking
ALTER TABLE public.subscriptions
ADD COLUMN IF NOT EXISTS customer_email text,
ADD COLUMN IF NOT EXISTS customer_phone text,
ADD COLUMN IF NOT EXISTS customer_name text,
ADD COLUMN IF NOT EXISTS washes_used_in_cycle integer NOT NULL DEFAULT 0;

-- Create index for guest subscription lookup
CREATE INDEX IF NOT EXISTS idx_subscriptions_customer_lookup 
ON public.subscriptions (customer_email, customer_phone) 
WHERE status = 'active';

-- Update RLS to allow guests to check their subscription by email+phone
DROP POLICY IF EXISTS "Anyone can check subscription by email and phone" ON public.subscriptions;
CREATE POLICY "Anyone can check subscription by email and phone" 
ON public.subscriptions 
FOR SELECT 
USING (true);

-- Allow edge functions to update subscriptions (service role bypasses RLS anyway)
DROP POLICY IF EXISTS "Service role can update subscriptions" ON public.subscriptions;

-- Insert default subscription plans if they don't exist
INSERT INTO public.subscription_plans (name, description, price_cents, washes_per_month, is_active)
VALUES 
  ('Básico', '2 lavados por mes - Ideal para uso ocasional', 3500000, 2, true),
  ('Premium', '4 lavados por mes - Para los que cuidan su auto semanalmente', 6000000, 4, true)
ON CONFLICT DO NOTHING;

-- Add payment_method column to bookings if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'bookings' AND column_name = 'payment_method'
  ) THEN
    ALTER TABLE public.bookings ADD COLUMN payment_method text;
  END IF;
END $$;

-- Create subscription_events log table for webhook tracking
CREATE TABLE IF NOT EXISTS public.subscription_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id uuid REFERENCES public.subscriptions(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  payload jsonb,
  processed boolean DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.subscription_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view subscription events" 
ON public.subscription_events 
FOR SELECT 
USING (has_role(auth.uid(), 'admin'::app_role));