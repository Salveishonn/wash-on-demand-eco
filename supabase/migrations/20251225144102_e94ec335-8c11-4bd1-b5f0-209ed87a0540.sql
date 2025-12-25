-- Update the calendar_bookings_v view to ONLY show confirmed (accepted) bookings, NOT completed
-- This is the operational calendar - it should show work to be done, not finished work

DROP VIEW IF EXISTS public.calendar_bookings_v;

CREATE VIEW public.calendar_bookings_v AS
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
WHERE 
    -- ONLY show confirmed bookings (accepted for operations)
    -- completed and cancelled are excluded by default
    status = 'confirmed'
    AND (
        -- Paid bookings
        payment_status = 'approved'
        -- OR subscription bookings
        OR is_subscription_booking = true
        -- OR pay-later/cash bookings (can be accepted before payment)
        OR (payment_status = 'pending' AND payment_method IN ('cash', 'pay_later'))
    );