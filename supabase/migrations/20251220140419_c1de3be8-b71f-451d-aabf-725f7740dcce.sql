-- Tabla de cola de notificaciones con retry y idempotencia
CREATE TABLE public.notification_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID REFERENCES public.bookings(id) ON DELETE CASCADE NOT NULL,
  notification_type TEXT NOT NULL CHECK (notification_type IN ('email', 'whatsapp')),
  recipient TEXT NOT NULL,
  
  -- Idempotency
  idempotency_key TEXT NOT NULL UNIQUE,
  
  -- Status tracking
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'sent', 'failed', 'exhausted')),
  
  -- Retry logic
  attempts INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 3,
  next_retry_at TIMESTAMPTZ,
  last_error TEXT,
  
  -- External reference
  external_id TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  sent_at TIMESTAMPTZ
);

-- Índices para procesamiento eficiente
CREATE INDEX idx_notification_queue_pending ON public.notification_queue(status, next_retry_at) 
  WHERE status IN ('pending', 'failed');
CREATE INDEX idx_notification_queue_booking ON public.notification_queue(booking_id);
CREATE INDEX idx_notification_queue_idempotency ON public.notification_queue(idempotency_key);

-- RLS
ALTER TABLE public.notification_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view notification queue"
  ON public.notification_queue FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

-- Trigger para updated_at
CREATE TRIGGER update_notification_queue_updated_at
  BEFORE UPDATE ON public.notification_queue
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Tabla para webhook logs (auditoría y debugging)
CREATE TABLE public.webhook_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source TEXT NOT NULL,
  event_type TEXT,
  payload JSONB,
  signature_valid BOOLEAN,
  processed BOOLEAN DEFAULT false,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.webhook_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view webhook logs"
  ON public.webhook_logs FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

-- Agregar campo de idempotency a bookings para evitar duplicados
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS webhook_processed_at TIMESTAMPTZ;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS notifications_queued BOOLEAN DEFAULT false;