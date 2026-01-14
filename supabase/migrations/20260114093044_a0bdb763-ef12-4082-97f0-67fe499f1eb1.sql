-- Create central contacts table for email capture
CREATE TABLE IF NOT EXISTS public.contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  name text,
  phone text,
  source text NOT NULL,
  tags text[] DEFAULT '{}',
  first_seen_at timestamptz DEFAULT now(),
  last_seen_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;

-- Admins can manage contacts
CREATE POLICY "Admins can manage contacts"
ON public.contacts
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Service role can insert/update contacts (for edge functions)
CREATE POLICY "Service role can upsert contacts"
ON public.contacts
FOR INSERT
WITH CHECK (true);

CREATE POLICY "Service role can update contacts"
ON public.contacts
FOR UPDATE
USING (true);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_contacts_email ON public.contacts(email);
CREATE INDEX IF NOT EXISTS idx_contacts_source ON public.contacts(source);
CREATE INDEX IF NOT EXISTS idx_contacts_last_seen ON public.contacts(last_seen_at DESC);