-- 1) Add new columns to contacts table
ALTER TABLE public.contacts 
  ADD COLUMN IF NOT EXISTS sources text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS last_activity_at timestamptz DEFAULT now();

-- 2) Migrate existing 'source' column data to 'sources' array
UPDATE public.contacts 
SET sources = ARRAY[source]
WHERE (sources = '{}' OR sources IS NULL) AND source IS NOT NULL;

-- 3) Create trigger function for updated_at
CREATE OR REPLACE FUNCTION public.update_contacts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create trigger
DROP TRIGGER IF EXISTS contacts_updated_at ON public.contacts;
CREATE TRIGGER contacts_updated_at
  BEFORE UPDATE ON public.contacts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_contacts_updated_at();

-- 4) Create upsert_contact RPC
CREATE OR REPLACE FUNCTION public.upsert_contact(
  p_email text,
  p_name text DEFAULT NULL,
  p_phone text DEFAULT NULL,
  p_source text DEFAULT NULL,
  p_tags text[] DEFAULT '{}'
)
RETURNS public.contacts
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email text;
  v_contact public.contacts;
BEGIN
  -- Normalize email
  v_email := lower(trim(p_email));
  
  -- Upsert the contact
  INSERT INTO public.contacts (email, name, phone, source, sources, tags, last_seen_at, last_activity_at)
  VALUES (
    v_email,
    p_name,
    p_phone,
    COALESCE(p_source, 'unknown'),
    CASE WHEN p_source IS NOT NULL THEN ARRAY[p_source] ELSE '{}' END,
    p_tags,
    now(),
    now()
  )
  ON CONFLICT (email) DO UPDATE SET
    name = COALESCE(EXCLUDED.name, contacts.name),
    phone = COALESCE(EXCLUDED.phone, contacts.phone),
    sources = (
      SELECT array_agg(DISTINCT s)
      FROM unnest(contacts.sources || CASE WHEN p_source IS NOT NULL THEN ARRAY[p_source] ELSE '{}' END) AS s
      WHERE s IS NOT NULL
    ),
    tags = (
      SELECT array_agg(DISTINCT t)
      FROM unnest(contacts.tags || p_tags) AS t
      WHERE t IS NOT NULL
    ),
    last_seen_at = now(),
    last_activity_at = now(),
    updated_at = now()
  RETURNING * INTO v_contact;
  
  RETURN v_contact;
END;
$$;

-- 5) Grant execute on the RPC to anon and authenticated
GRANT EXECUTE ON FUNCTION public.upsert_contact(text, text, text, text, text[]) TO anon;
GRANT EXECUTE ON FUNCTION public.upsert_contact(text, text, text, text, text[]) TO authenticated;