
-- Add new columns to subscription_plans for plan type metadata
ALTER TABLE public.subscription_plans
  ADD COLUMN IF NOT EXISTS plan_type text NOT NULL DEFAULT 'individual',
  ADD COLUMN IF NOT EXISTS max_vehicles integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS shared_usage boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS included_service_type text NOT NULL DEFAULT 'lavado_basico',
  ADD COLUMN IF NOT EXISTS ideal_for text,
  ADD COLUMN IF NOT EXISTS customer_copy text;

-- Add same columns to subscriptions for snapshotting plan metadata
ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS plan_type text DEFAULT 'individual',
  ADD COLUMN IF NOT EXISTS max_vehicles integer DEFAULT 1,
  ADD COLUMN IF NOT EXISTS shared_usage boolean DEFAULT false;

-- Create subscription_vehicles junction table
CREATE TABLE IF NOT EXISTS public.subscription_vehicles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id uuid NOT NULL REFERENCES public.subscriptions(id) ON DELETE CASCADE,
  car_id uuid NOT NULL REFERENCES public.cars(id) ON DELETE CASCADE,
  added_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(subscription_id, car_id)
);

ALTER TABLE public.subscription_vehicles ENABLE ROW LEVEL SECURITY;

-- Users can view their own subscription vehicles
CREATE POLICY "Users can view their subscription vehicles"
  ON public.subscription_vehicles FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.subscriptions s
      WHERE s.id = subscription_id AND s.user_id = auth.uid()
    )
  );

-- Users can add vehicles to their subscriptions
CREATE POLICY "Users can add vehicles to their subscriptions"
  ON public.subscription_vehicles FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.subscriptions s
      WHERE s.id = subscription_id AND s.user_id = auth.uid()
    )
  );

-- Users can remove vehicles from their subscriptions
CREATE POLICY "Users can remove vehicles from their subscriptions"
  ON public.subscription_vehicles FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.subscriptions s
      WHERE s.id = subscription_id AND s.user_id = auth.uid()
    )
  );

-- Admins can manage all subscription vehicles
CREATE POLICY "Admins can manage subscription vehicles"
  ON public.subscription_vehicles FOR ALL
  TO public
  USING (has_role(auth.uid(), 'admin'::app_role));
