-- booking_requests additions
ALTER TABLE public.booking_requests
  ADD COLUMN IF NOT EXISTS payment_method text,
  ADD COLUMN IF NOT EXISTS parsed_data jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS missing_fields text[] DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS parsing_warnings text[] DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS communication_provider text DEFAULT 'botmaker',
  ADD COLUMN IF NOT EXISTS reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS review_reason text;

-- botmaker_events additions
ALTER TABLE public.botmaker_events
  ADD COLUMN IF NOT EXISTS communication_provider text DEFAULT 'botmaker';

CREATE INDEX IF NOT EXISTS idx_botmaker_events_created_at ON public.botmaker_events (created_at DESC);

-- botmaker_conversations
CREATE TABLE IF NOT EXISTS public.botmaker_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id text NOT NULL UNIQUE,
  customer_phone text,
  customer_name text,
  channel text DEFAULT 'whatsapp',
  last_message_at timestamptz DEFAULT now(),
  last_message_preview text,
  last_direction text,
  unread_count integer NOT NULL DEFAULT 0,
  linked_customer_id uuid,
  linked_booking_request_id uuid,
  linked_booking_id uuid,
  communication_provider text NOT NULL DEFAULT 'botmaker',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.botmaker_conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view botmaker conversations"
  ON public.botmaker_conversations FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Service role manages botmaker conversations insert"
  ON public.botmaker_conversations FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Service role manages botmaker conversations update"
  ON public.botmaker_conversations FOR UPDATE
  USING (true);

CREATE INDEX IF NOT EXISTS idx_botmaker_conversations_last_message ON public.botmaker_conversations (last_message_at DESC);

-- botmaker_messages
CREATE TABLE IF NOT EXISTS public.botmaker_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id text NOT NULL,
  direction text NOT NULL,
  sender text,
  body text,
  raw jsonb DEFAULT '{}'::jsonb,
  provider_message_id text,
  communication_provider text NOT NULL DEFAULT 'botmaker',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.botmaker_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view botmaker messages"
  ON public.botmaker_messages FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Service role inserts botmaker messages"
  ON public.botmaker_messages FOR INSERT
  WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_botmaker_messages_conv_created ON public.botmaker_messages (conversation_id, created_at DESC);