-- Add barrio/neighborhood tracking fields to early_access_leads
ALTER TABLE public.early_access_leads
ADD COLUMN barrio TEXT,
ADD COLUMN wants_barrio_coordination BOOLEAN DEFAULT false;