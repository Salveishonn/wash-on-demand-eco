
-- Add audio/media columns to whatsapp_messages
ALTER TABLE public.whatsapp_messages
  ADD COLUMN IF NOT EXISTS message_type text NOT NULL DEFAULT 'text',
  ADD COLUMN IF NOT EXISTS media_url text,
  ADD COLUMN IF NOT EXISTS media_mime_type text;

-- Create storage bucket for WhatsApp media
INSERT INTO storage.buckets (id, name, public)
VALUES ('whatsapp-media', 'whatsapp-media', true)
ON CONFLICT (id) DO NOTHING;

-- RLS: Allow admins to read whatsapp-media files
CREATE POLICY "Admins can read whatsapp media"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'whatsapp-media' AND public.has_role(auth.uid(), 'admin'));

-- RLS: Allow service role (edge functions) to insert whatsapp-media files
CREATE POLICY "Service role can upload whatsapp media"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'whatsapp-media');
