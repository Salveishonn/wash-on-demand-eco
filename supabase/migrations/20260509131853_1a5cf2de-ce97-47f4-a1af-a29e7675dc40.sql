ALTER TABLE public.whatsapp_messages
  ADD COLUMN IF NOT EXISTS playable_media_storage_path TEXT,
  ADD COLUMN IF NOT EXISTS playable_media_mime_type TEXT,
  ADD COLUMN IF NOT EXISTS media_transcode_status TEXT,
  ADD COLUMN IF NOT EXISTS media_transcode_error TEXT;

CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_audio_transcode
  ON public.whatsapp_messages (message_type, media_transcode_status)
  WHERE message_type IN ('audio', 'voice');