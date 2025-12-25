-- Update payment_settings table with additional fields
ALTER TABLE public.payment_settings
ADD COLUMN IF NOT EXISTS account_holder_name text,
ADD COLUMN IF NOT EXISTS bank_name text,
ADD COLUMN IF NOT EXISTS whatsapp_admin_phone text;

-- Update the existing seed row with default values
UPDATE public.payment_settings 
SET 
  mp_alias = COALESCE(mp_alias, 'washero.online'),
  mp_payment_link = COALESCE(mp_payment_link, 'https://link.mercadopago.com.ar/washero'),
  account_holder_name = COALESCE(account_holder_name, 'Washero'),
  is_enabled = true
WHERE id = (SELECT id FROM public.payment_settings LIMIT 1);

-- Create payment_intent_type enum
DO $$ BEGIN
  CREATE TYPE public.payment_intent_type AS ENUM ('one_time', 'subscription_monthly');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Create payment_intent_status enum
DO $$ BEGIN
  CREATE TYPE public.payment_intent_status AS ENUM ('pending', 'paid', 'expired', 'cancelled');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Create payment_intents table
CREATE TABLE IF NOT EXISTS public.payment_intents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid REFERENCES public.bookings(id) ON DELETE CASCADE,
  subscription_id uuid REFERENCES public.subscriptions(id) ON DELETE CASCADE,
  type public.payment_intent_type NOT NULL DEFAULT 'one_time',
  amount_ars integer NOT NULL,
  currency text NOT NULL DEFAULT 'ARS',
  status public.payment_intent_status NOT NULL DEFAULT 'pending',
  proof_submitted boolean NOT NULL DEFAULT false,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Create payment_proofs table
CREATE TABLE IF NOT EXISTS public.payment_proofs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_intent_id uuid NOT NULL REFERENCES public.payment_intents(id) ON DELETE CASCADE,
  payer_name text,
  reference text,
  receipt_url text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Create subscription_credits table
CREATE TABLE IF NOT EXISTS public.subscription_credits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id uuid NOT NULL REFERENCES public.subscriptions(id) ON DELETE CASCADE,
  month text NOT NULL, -- Format: YYYY-MM
  total_credits integer NOT NULL,
  remaining_credits integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(subscription_id, month)
);

-- Add payment_intent_id to bookings table
ALTER TABLE public.bookings
ADD COLUMN IF NOT EXISTS payment_intent_id uuid REFERENCES public.payment_intents(id);

-- Enable RLS on new tables
ALTER TABLE public.payment_intents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_proofs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_credits ENABLE ROW LEVEL SECURITY;

-- payment_intents policies
CREATE POLICY "Anyone can view payment intents by id" ON public.payment_intents
FOR SELECT USING (true);

CREATE POLICY "Service role can insert payment intents" ON public.payment_intents
FOR INSERT WITH CHECK (true);

CREATE POLICY "Admins can update payment intents" ON public.payment_intents
FOR UPDATE USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete payment intents" ON public.payment_intents
FOR DELETE USING (public.has_role(auth.uid(), 'admin'));

-- payment_proofs policies
CREATE POLICY "Anyone can view payment proofs" ON public.payment_proofs
FOR SELECT USING (true);

CREATE POLICY "Anyone can submit payment proofs" ON public.payment_proofs
FOR INSERT WITH CHECK (true);

CREATE POLICY "Admins can update payment proofs" ON public.payment_proofs
FOR UPDATE USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete payment proofs" ON public.payment_proofs
FOR DELETE USING (public.has_role(auth.uid(), 'admin'));

-- subscription_credits policies
CREATE POLICY "Admins can view subscription credits" ON public.subscription_credits
FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Service role can manage subscription credits" ON public.subscription_credits
FOR ALL USING (true);

-- Add updated_at trigger to payment_intents
CREATE TRIGGER update_payment_intents_updated_at
BEFORE UPDATE ON public.payment_intents
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add updated_at trigger to subscription_credits
CREATE TRIGGER update_subscription_credits_updated_at
BEFORE UPDATE ON public.subscription_credits
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();