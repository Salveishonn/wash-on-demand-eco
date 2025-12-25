-- Create payment_settings table for MP alias/link info
CREATE TABLE public.payment_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mp_alias text NOT NULL,
  mp_payment_link text NOT NULL,
  mp_cvu text,
  mp_holder_name text,
  mp_notes text,
  is_enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.payment_settings ENABLE ROW LEVEL SECURITY;

-- Anyone can read enabled settings (for email generation)
CREATE POLICY "Anyone can view enabled payment settings"
ON public.payment_settings
FOR SELECT
USING (is_enabled = true);

-- Only admins can modify
CREATE POLICY "Admins can manage payment settings"
ON public.payment_settings
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Seed initial row with placeholder values
INSERT INTO public.payment_settings (mp_alias, mp_payment_link, mp_holder_name, mp_notes)
VALUES (
  'washero.online',
  'https://link.mercadopago.com.ar/washero',
  'Washero Car Wash',
  'Incluir referencia de reserva en el concepto'
);

-- Add message_type column to notification_logs if not exists
DO $$ 
BEGIN 
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'notification_logs' AND column_name = 'message_type') THEN
    ALTER TABLE public.notification_logs ADD COLUMN message_type text;
  END IF;
END $$;

-- Create trigger for updated_at
CREATE TRIGGER update_payment_settings_updated_at
BEFORE UPDATE ON public.payment_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();