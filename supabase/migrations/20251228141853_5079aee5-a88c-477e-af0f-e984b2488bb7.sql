-- Add booking_source column to track QR/marketing attribution
ALTER TABLE public.bookings 
ADD COLUMN IF NOT EXISTS booking_source text DEFAULT 'direct';

-- Add comment for documentation
COMMENT ON COLUMN public.bookings.booking_source IS 'Source of the booking: van, flyer, banner, direct, etc.';