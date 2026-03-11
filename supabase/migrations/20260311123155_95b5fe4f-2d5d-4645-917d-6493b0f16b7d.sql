
-- Error logging table for monitoring
CREATE TABLE public.app_error_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  source text NOT NULL,
  error_type text NOT NULL,
  message text,
  details jsonb DEFAULT '{}'::jsonb,
  request_ip text,
  user_agent text,
  resolved boolean NOT NULL DEFAULT false
);

ALTER TABLE public.app_error_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage error logs"
  ON public.app_error_logs FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Service role can insert error logs"
  ON public.app_error_logs FOR INSERT
  WITH CHECK (true);

-- Login attempts table for brute force protection
CREATE TABLE public.login_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  email text NOT NULL,
  ip_address text,
  user_agent text,
  success boolean NOT NULL DEFAULT false
);

ALTER TABLE public.login_attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view login attempts"
  ON public.login_attempts FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Service role can insert login attempts"
  ON public.login_attempts FOR INSERT
  WITH CHECK (true);

-- Rate limiting table
CREATE TABLE public.rate_limits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL,
  window_start timestamptz NOT NULL DEFAULT now(),
  count integer NOT NULL DEFAULT 1,
  UNIQUE(key)
);

ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role can manage rate limits"
  ON public.rate_limits FOR ALL
  WITH CHECK (true);

-- Index for fast lookups
CREATE INDEX idx_rate_limits_key ON public.rate_limits(key);
CREATE INDEX idx_login_attempts_email ON public.login_attempts(email, created_at);
CREATE INDEX idx_app_error_logs_source ON public.app_error_logs(source, created_at);
