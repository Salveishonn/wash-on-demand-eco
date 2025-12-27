-- Drop and recreate the view with SECURITY INVOKER to use the querying user's permissions
DROP VIEW IF EXISTS public.whatsapp_conversations_v;

CREATE VIEW public.whatsapp_conversations_v 
WITH (security_invoker = true)
AS
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