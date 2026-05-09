
ALTER TABLE public.whatsapp_messages
  ADD COLUMN IF NOT EXISTS media_filename TEXT,
  ADD COLUMN IF NOT EXISTS media_caption TEXT,
  ADD COLUMN IF NOT EXISTS media_size INTEGER,
  ADD COLUMN IF NOT EXISTS media_id TEXT,
  ADD COLUMN IF NOT EXISTS media_storage_path TEXT;
