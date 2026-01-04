-- Add last_inbound_at column to track 24h session window
ALTER TABLE public.whatsapp_conversations 
ADD COLUMN IF NOT EXISTS last_inbound_at timestamp with time zone DEFAULT NULL;

-- Add index for efficient lookups
CREATE INDEX IF NOT EXISTS idx_whatsapp_conversations_last_inbound_at 
ON public.whatsapp_conversations(last_inbound_at);

-- Update existing conversations: set last_inbound_at from last inbound message
UPDATE public.whatsapp_conversations c
SET last_inbound_at = (
  SELECT MAX(m.created_at)
  FROM public.whatsapp_messages m
  WHERE m.conversation_id = c.id 
  AND m.direction = 'inbound'
);

-- Seed the whatsapp_templates table with required templates
INSERT INTO public.whatsapp_templates (name, description, parameter_count, is_active)
VALUES
  ('washero_booking_confirmed', 'Booking confirmation with date/time', 3, true),
  ('washero_on_the_way', 'On the way notification', 2, true),
  ('washero_arriving_10_min', 'Arriving in 10 minutes', 2, true),
  ('washero_arrived', 'We have arrived', 1, true),
  ('washero_reschedule_request', 'Request to reschedule', 1, true),
  ('washero_payment_instructions', 'Payment instructions with link', 2, true)
ON CONFLICT (name) DO UPDATE SET
  description = EXCLUDED.description,
  parameter_count = EXCLUDED.parameter_count,
  is_active = EXCLUDED.is_active;