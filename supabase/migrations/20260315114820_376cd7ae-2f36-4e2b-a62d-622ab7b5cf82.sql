
CREATE TABLE public.whatsapp_template_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text NOT NULL,
  template_name text NOT NULL,
  language_code text NOT NULL DEFAULT 'es_AR',
  customer_phone text NOT NULL,
  template_vars jsonb NOT NULL DEFAULT '[]'::jsonb,
  booking_id uuid REFERENCES public.bookings(id) ON DELETE SET NULL,
  subscription_id uuid REFERENCES public.subscriptions(id) ON DELETE SET NULL,
  outbox_id uuid,
  status text NOT NULL DEFAULT 'queued',
  wa_message_id text,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.whatsapp_template_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage template logs"
  ON public.whatsapp_template_logs FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX idx_template_logs_booking ON public.whatsapp_template_logs(booking_id);
CREATE INDEX idx_template_logs_created ON public.whatsapp_template_logs(created_at DESC);
