
-- Add discount fields to bookings table
ALTER TABLE public.bookings 
  ADD COLUMN IF NOT EXISTS discount_type text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS discount_percent numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS discount_amount_ars integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS final_price_ars integer DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS is_launch_founder_slot boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS discount_locked boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS barrio text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS barrio_discount_qualified_at timestamptz DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS barrio_group_key text DEFAULT NULL;

-- Add comment for clarity
COMMENT ON COLUMN public.bookings.discount_type IS 'launch_founder | barrio | null';
COMMENT ON COLUMN public.bookings.discount_percent IS 'Discount percentage applied (20 or 30)';
COMMENT ON COLUMN public.bookings.discount_amount_ars IS 'Discount amount in ARS';
COMMENT ON COLUMN public.bookings.final_price_ars IS 'Final price after discount in ARS';
COMMENT ON COLUMN public.bookings.is_launch_founder_slot IS 'True if this is one of the first 30 launch bookings';
COMMENT ON COLUMN public.bookings.discount_locked IS 'Once true, discount cannot be removed';
COMMENT ON COLUMN public.bookings.barrio IS 'Normalized neighborhood/barrio for grouping';
COMMENT ON COLUMN public.bookings.barrio_group_key IS 'barrio::booking_date composite key for grouping';
