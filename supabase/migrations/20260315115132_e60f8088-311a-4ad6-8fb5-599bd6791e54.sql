
CREATE OR REPLACE VIEW public.calendar_bookings_v AS
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
  total_cents,
  status AS booking_status,
  payment_status,
  payment_method,
  subscription_id,
  is_subscription_booking,
  notes,
  created_at,
  confirmed_at,
  booking_source,
  whatsapp_opt_in,
  customer_id,
  whatsapp_message_status,
  whatsapp_last_message_type
FROM bookings b
ORDER BY booking_date, booking_time;
