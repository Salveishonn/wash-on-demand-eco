
-- Push notification subscriptions for operators
CREATE TABLE public.push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  endpoint text NOT NULL,
  p256dh text NOT NULL,
  auth text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, endpoint)
);

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own push subscriptions"
  ON public.push_subscriptions FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Operator notifications table
CREATE TABLE public.operator_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid, -- null = broadcast to all operators
  event_type text NOT NULL, -- new_booking, booking_cancelled, new_whatsapp, payment_received, etc.
  title text NOT NULL,
  body text NOT NULL,
  data jsonb DEFAULT '{}',
  read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.operator_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read all notifications"
  ON public.operator_notifications FOR SELECT TO authenticated
  USING (
    user_id = auth.uid() 
    OR user_id IS NULL 
    OR public.has_role(auth.uid(), 'admin')
  );

CREATE POLICY "Admins can update notifications"
  ON public.operator_notifications FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Enable realtime for operator notifications
ALTER PUBLICATION supabase_realtime ADD TABLE public.operator_notifications;

-- Index for fast notification queries
CREATE INDEX idx_operator_notifications_user_read ON public.operator_notifications(user_id, read, created_at DESC);
CREATE INDEX idx_operator_notifications_created ON public.operator_notifications(created_at DESC);
