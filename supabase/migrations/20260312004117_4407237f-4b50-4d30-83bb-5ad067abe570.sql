
-- 1. Add lat/lng to bookings
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS latitude double precision;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS longitude double precision;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS cluster_size integer DEFAULT 0;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS cluster_discount_percent numeric DEFAULT 0;

-- 2. Create cluster_discount_tiers table (admin-editable)
CREATE TABLE public.cluster_discount_tiers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  min_nearby integer NOT NULL,
  max_nearby integer, -- NULL means unlimited (e.g. 4+)
  discount_percent numeric NOT NULL DEFAULT 0,
  label text NOT NULL,
  emoji text DEFAULT '',
  radius_km numeric NOT NULL DEFAULT 5,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 3. Enable RLS
ALTER TABLE public.cluster_discount_tiers ENABLE ROW LEVEL SECURITY;

-- 4. RLS policies
CREATE POLICY "Anyone can view active tiers"
  ON public.cluster_discount_tiers FOR SELECT
  TO public
  USING (is_active = true);

CREATE POLICY "Admins can manage tiers"
  ON public.cluster_discount_tiers FOR ALL
  TO public
  USING (has_role(auth.uid(), 'admin'::app_role));

-- 5. Create haversine distance function
CREATE OR REPLACE FUNCTION public.haversine_distance(
  lat1 double precision, lng1 double precision,
  lat2 double precision, lng2 double precision
)
RETURNS double precision
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT 6371 * 2 * ASIN(SQRT(
    POWER(SIN(RADIANS(lat2 - lat1) / 2), 2) +
    COS(RADIANS(lat1)) * COS(RADIANS(lat2)) *
    POWER(SIN(RADIANS(lng2 - lng1) / 2), 2)
  ))
$$;

-- 6. Count nearby bookings function
CREATE OR REPLACE FUNCTION public.count_nearby_bookings(
  p_date date,
  p_lat double precision,
  p_lng double precision,
  p_radius_km double precision DEFAULT 5,
  p_exclude_booking_id uuid DEFAULT NULL
)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*)::integer
  FROM public.bookings
  WHERE booking_date = p_date
    AND latitude IS NOT NULL
    AND longitude IS NOT NULL
    AND status IN ('pending', 'confirmed', 'completed')
    AND is_test = false
    AND (p_exclude_booking_id IS NULL OR id != p_exclude_booking_id)
    AND haversine_distance(p_lat, p_lng, latitude, longitude) <= p_radius_km
$$;

-- 7. Get cluster discount for a given count
CREATE OR REPLACE FUNCTION public.get_cluster_discount(p_nearby_count integer)
RETURNS numeric
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT discount_percent
     FROM public.cluster_discount_tiers
     WHERE is_active = true
       AND p_nearby_count >= min_nearby
       AND (max_nearby IS NULL OR p_nearby_count <= max_nearby)
     ORDER BY min_nearby DESC
     LIMIT 1),
    0
  )
$$;
