
-- Create invoices table
CREATE TABLE public.invoices (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  booking_id UUID NULL REFERENCES public.bookings(id) ON DELETE SET NULL,
  subscription_id UUID NULL REFERENCES public.subscriptions(id) ON DELETE SET NULL,
  invoice_number TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'pending_payment' CHECK (status IN ('pending_payment', 'paid', 'void')),
  amount_ars INTEGER NOT NULL,
  issued_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  paid_at TIMESTAMP WITH TIME ZONE NULL,
  pdf_url TEXT NULL,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create index for invoice lookups
CREATE INDEX idx_invoices_user_id ON public.invoices(user_id);
CREATE INDEX idx_invoices_booking_id ON public.invoices(booking_id);
CREATE INDEX idx_invoices_subscription_id ON public.invoices(subscription_id);
CREATE INDEX idx_invoices_status ON public.invoices(status);

-- Enable RLS
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

-- RLS policies for invoices
CREATE POLICY "Users can view their own invoices" 
ON public.invoices 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all invoices"
ON public.invoices
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can insert invoices"
ON public.invoices
FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Service role can insert invoices"
ON public.invoices
FOR INSERT
WITH CHECK (true);

CREATE POLICY "Admins can update invoices"
ON public.invoices
FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Create sequence for invoice numbers
CREATE SEQUENCE IF NOT EXISTS invoice_number_seq START WITH 1;

-- Function to generate invoice number
CREATE OR REPLACE FUNCTION public.generate_invoice_number()
RETURNS TEXT
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  next_val INTEGER;
BEGIN
  next_val := nextval('invoice_number_seq');
  RETURN 'WSH-' || lpad(next_val::text, 6, '0');
END;
$$;

-- Update trigger for invoices
CREATE TRIGGER update_invoices_updated_at
BEFORE UPDATE ON public.invoices
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create webhook events log table
CREATE TABLE public.webhook_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}',
  delivered BOOLEAN NOT NULL DEFAULT false,
  delivered_at TIMESTAMP WITH TIME ZONE NULL,
  error TEXT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Index for webhook events
CREATE INDEX idx_webhook_events_type ON public.webhook_events(event_type);
CREATE INDEX idx_webhook_events_delivered ON public.webhook_events(delivered);

-- Enable RLS on webhook events
ALTER TABLE public.webhook_events ENABLE ROW LEVEL SECURITY;

-- Only admins can view webhook events
CREATE POLICY "Admins can view webhook events"
ON public.webhook_events
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- Create invoices storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('invoices', 'invoices', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for invoices bucket
CREATE POLICY "Anyone can view invoice PDFs"
ON storage.objects
FOR SELECT
USING (bucket_id = 'invoices');

CREATE POLICY "Service role can upload invoices"
ON storage.objects
FOR INSERT
WITH CHECK (bucket_id = 'invoices');

-- Add admin_decision fields to subscriptions if not exists
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'subscriptions' AND column_name = 'admin_decision_by') THEN
    ALTER TABLE public.subscriptions ADD COLUMN admin_decision_by UUID NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'subscriptions' AND column_name = 'admin_decision_at') THEN
    ALTER TABLE public.subscriptions ADD COLUMN admin_decision_at TIMESTAMP WITH TIME ZONE NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'subscriptions' AND column_name = 'admin_decision_reason') THEN
    ALTER TABLE public.subscriptions ADD COLUMN admin_decision_reason TEXT NULL;
  END IF;
END $$;
