-- Create kipper_leads table for partnership lead tracking
CREATE TABLE public.kipper_leads (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_name TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  customer_email TEXT NOT NULL,
  vehicle_type TEXT,
  booking_id UUID REFERENCES public.bookings(id),
  source TEXT NOT NULL DEFAULT 'booking', -- booking, confirmation, subscription
  status TEXT NOT NULL DEFAULT 'new', -- new, contacted, converted, not_interested
  notes TEXT,
  kipper_benefit_applied BOOLEAN DEFAULT false,
  benefit_type TEXT, -- discount_percentage, extra_washes, vip
  benefit_value TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.kipper_leads ENABLE ROW LEVEL SECURITY;

-- Admin can view all leads
CREATE POLICY "Admins can view all kipper leads"
ON public.kipper_leads
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- Admin can update leads
CREATE POLICY "Admins can update kipper leads"
ON public.kipper_leads
FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Admin can delete leads
CREATE POLICY "Admins can delete kipper leads"
ON public.kipper_leads
FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Anyone can create leads (public form)
CREATE POLICY "Anyone can create kipper leads"
ON public.kipper_leads
FOR INSERT
WITH CHECK (true);

-- Create trigger for updated_at
CREATE TRIGGER update_kipper_leads_updated_at
BEFORE UPDATE ON public.kipper_leads
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add index for common queries
CREATE INDEX idx_kipper_leads_status ON public.kipper_leads(status);
CREATE INDEX idx_kipper_leads_source ON public.kipper_leads(source);
CREATE INDEX idx_kipper_leads_created_at ON public.kipper_leads(created_at DESC);