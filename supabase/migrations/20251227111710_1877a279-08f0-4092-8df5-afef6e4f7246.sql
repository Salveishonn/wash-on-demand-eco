-- Create unique index on (booking_date, booking_time) only for active bookings (pending/confirmed)
-- This prevents double-bookings for the same slot
CREATE UNIQUE INDEX IF NOT EXISTS bookings_unique_active_slot 
ON public.bookings (booking_date, booking_time) 
WHERE status IN ('pending', 'confirmed');

-- Add an index for efficient availability queries
CREATE INDEX IF NOT EXISTS idx_bookings_date_time_status 
ON public.bookings (booking_date, booking_time, status);