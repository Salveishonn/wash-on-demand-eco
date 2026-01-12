-- Create early_access_leads table for pre-launch signups
CREATE TABLE public.early_access_leads (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.early_access_leads ENABLE ROW LEVEL SECURITY;

-- Anyone can submit (insert) leads
CREATE POLICY "Anyone can submit early access leads"
ON public.early_access_leads
FOR INSERT
WITH CHECK (true);

-- Only admins can view leads
CREATE POLICY "Admins can view early access leads"
ON public.early_access_leads
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));