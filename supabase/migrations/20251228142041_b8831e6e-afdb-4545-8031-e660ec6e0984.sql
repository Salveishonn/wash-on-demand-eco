-- Drop the existing view and recreate with booking_source
DROP VIEW IF EXISTS public.calendar_bookings_v;

CREATE VIEW public.calendar_bookings_v AS
SELECT 
  id,
  customer_name,
  customer_phone,
  customer_email,
  address,
  service_name,
  car_type,
  service_price_cents,
  car_type_extra_cents,
  addons,
  addons_total_cents,
  COALESCE(total_cents, service_price_cents + COALESCE(car_type_extra_cents, 0) + COALESCE(addons_total_cents, 0)) AS total_cents,
  booking_date,
  booking_time,
  status AS booking_status,
  payment_status,
  payment_method,
  subscription_id,
  is_subscription_booking,
  notes,
  created_at,
  confirmed_at,
  booking_source
FROM public.bookings
WHERE status NOT IN ('cancelled', 'completed');