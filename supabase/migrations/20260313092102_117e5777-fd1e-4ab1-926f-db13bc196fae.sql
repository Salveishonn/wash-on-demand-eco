
-- Fix overly permissive RLS policies on user_bookings, user_subscriptions, and users tables

-- 1. user_bookings: Drop public SELECT, replace with owner-scoped
DROP POLICY IF EXISTS "Anyone can view bookings" ON public.user_bookings;
CREATE POLICY "Users can view their own bookings" ON public.user_bookings
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- Also lock down the INSERT to authenticated owner-only
DROP POLICY IF EXISTS "Anyone can insert bookings" ON public.user_bookings;
CREATE POLICY "Users can insert their own bookings" ON public.user_bookings
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- 2. user_subscriptions: Drop public SELECT, replace with owner-scoped
DROP POLICY IF EXISTS "Users can view their own subscriptions" ON public.user_subscriptions;
CREATE POLICY "Owner can view their subscriptions" ON public.user_subscriptions
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- Also lock down the INSERT to authenticated owner-only
DROP POLICY IF EXISTS "Anyone can insert subscriptions" ON public.user_subscriptions;
CREATE POLICY "Owner can insert their subscriptions" ON public.user_subscriptions
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- 3. users: Drop the two dangerous open policies
DROP POLICY IF EXISTS "Anyone can read their own user by phone" ON public.users;
DROP POLICY IF EXISTS "Anyone can update users by phone" ON public.users;

-- Replace with admin-only SELECT (edge functions use service role and bypass RLS)
-- No authenticated user needs direct access to this table from client
