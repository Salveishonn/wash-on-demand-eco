-- Create outgoing_messages table for customer notifications
CREATE TABLE public.outgoing_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  booking_id UUID NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  customer_phone TEXT NOT NULL,
  type TEXT NOT NULL,
  channel TEXT NOT NULL DEFAULT 'pending',
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued',
  provider_message_id TEXT,
  error TEXT
);

-- Enable RLS
ALTER TABLE public.outgoing_messages ENABLE ROW LEVEL SECURITY;

-- Create indexes
CREATE INDEX idx_outgoing_messages_booking_id ON public.outgoing_messages(booking_id);
CREATE INDEX idx_outgoing_messages_created_at ON public.outgoing_messages(created_at DESC);

-- RLS Policies: Only admins can view and manage
CREATE POLICY "Admins can view outgoing messages"
ON public.outgoing_messages
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can insert outgoing messages"
ON public.outgoing_messages
FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update outgoing messages"
ON public.outgoing_messages
FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role));