
-- Add is_test column to bookings
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS is_test boolean NOT NULL DEFAULT false;

-- Add is_test column to contacts
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS is_test boolean NOT NULL DEFAULT false;

-- Add is_test column to early_access_leads
ALTER TABLE public.early_access_leads ADD COLUMN IF NOT EXISTS is_test boolean NOT NULL DEFAULT false;

-- Create admin_logs table for tracking admin actions
CREATE TABLE IF NOT EXISTS public.admin_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id uuid NOT NULL,
  action text NOT NULL,
  details jsonb DEFAULT '{}'::jsonb,
  affected_table text,
  affected_count integer DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.admin_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage admin_logs"
  ON public.admin_logs
  FOR ALL
  USING (public.has_role(auth.uid(), 'admin'::app_role));
