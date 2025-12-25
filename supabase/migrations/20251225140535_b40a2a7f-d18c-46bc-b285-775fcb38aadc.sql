-- Create a view for calendar bookings (operational bookings that should appear on calendar)
CREATE OR REPLACE VIEW public.calendar_bookings_v AS
SELECT
  b.id,
  b.booking_date,
  b.booking_time,
  b.customer_name,
  b.customer_phone,
  b.customer_email,
  b.address,
  b.service_name,
  b.car_type,
  b.service_price_cents,
  b.car_type_extra_cents,
  (b.service_price_cents + COALESCE(b.car_type_extra_cents, 0)) AS total_cents,
  b.status AS booking_status,
  b.payment_status,
  b.payment_method,
  b.subscription_id,
  b.is_subscription_booking,
  b.notes,
  b.created_at,
  b.confirmed_at
FROM public.bookings b
WHERE 
  b.status IN ('confirmed', 'completed')
  AND (
    b.payment_status IN ('approved')
    OR b.is_subscription_booking = true
    OR (b.payment_status = 'pending' AND b.payment_method IN ('cash', 'pay_later'))
  );

-- Grant access to the view for authenticated users (admin RLS will apply via function)
GRANT SELECT ON public.calendar_bookings_v TO authenticated;
GRANT SELECT ON public.calendar_bookings_v TO anon;