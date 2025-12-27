-- Drop and recreate calendar_bookings_v to include pending AND confirmed bookings
DROP VIEW IF EXISTS calendar_bookings_v;

CREATE VIEW calendar_bookings_v AS
SELECT 
  id,
  booking_date,
  booking_time,
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
  (service_price_cents + COALESCE(car_type_extra_cents, 0) + COALESCE(addons_total_cents, 0)) AS total_cents,
  status AS booking_status,
  payment_status,
  payment_method,
  subscription_id,
  is_subscription_booking,
  notes,
  created_at,
  confirmed_at
FROM bookings b
WHERE status IN ('pending', 'confirmed');