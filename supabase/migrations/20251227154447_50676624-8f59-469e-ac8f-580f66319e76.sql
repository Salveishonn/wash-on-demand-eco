-- WhatsApp Conversations table
CREATE TABLE public.whatsapp_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NULL,
  customer_name text NULL,
  customer_phone_e164 text NOT NULL,
  last_message_preview text NULL,
  last_message_at timestamptz NOT NULL DEFAULT now(),
  last_admin_seen_at timestamptz NULL,
  is_open boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Index for phone lookup
CREATE INDEX idx_whatsapp_conversations_phone ON public.whatsapp_conversations(customer_phone_e164);

-- Index for sorting by recent activity
CREATE INDEX idx_whatsapp_conversations_last_message ON public.whatsapp_conversations(last_message_at DESC);

-- Enable RLS
ALTER TABLE public.whatsapp_conversations ENABLE ROW LEVEL SECURITY;

-- Admin-only policies for conversations
CREATE POLICY "Admins can view whatsapp conversations"
ON public.whatsapp_conversations
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can insert whatsapp conversations"
ON public.whatsapp_conversations
FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update whatsapp conversations"
ON public.whatsapp_conversations
FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete whatsapp conversations"
ON public.whatsapp_conversations
FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- WhatsApp Messages table
CREATE TABLE public.whatsapp_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.whatsapp_conversations(id) ON DELETE CASCADE,
  direction text NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  body text NOT NULL,
  twilio_message_sid text NULL,
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'sent', 'delivered', 'read', 'failed', 'received')),
  error text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NULL
);

-- Index for conversation messages
CREATE INDEX idx_whatsapp_messages_conversation ON public.whatsapp_messages(conversation_id, created_at DESC);

-- Enable RLS
ALTER TABLE public.whatsapp_messages ENABLE ROW LEVEL SECURITY;

-- Admin-only policies for messages
CREATE POLICY "Admins can view whatsapp messages"
ON public.whatsapp_messages
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can insert whatsapp messages"
ON public.whatsapp_messages
FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update whatsapp messages"
ON public.whatsapp_messages
FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete whatsapp messages"
ON public.whatsapp_messages
FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- View for conversations with unread count
CREATE OR REPLACE VIEW public.whatsapp_conversations_v AS
SELECT 
  c.id,
  c.customer_phone_e164,
  c.customer_name,
  c.last_message_preview,
  c.last_message_at,
  c.is_open,
  c.last_admin_seen_at,
  c.created_at,
  COALESCE(
    (SELECT COUNT(*) 
     FROM public.whatsapp_messages m 
     WHERE m.conversation_id = c.id 
       AND m.direction = 'inbound' 
       AND m.created_at > COALESCE(c.last_admin_seen_at, '1970-01-01'::timestamptz)
    ), 0
  )::integer AS unread_count
FROM public.whatsapp_conversations c;