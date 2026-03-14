
-- Add extended profile fields
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS last_name text,
  ADD COLUMN IF NOT EXISTS dni text,
  ADD COLUMN IF NOT EXISTS gender text,
  ADD COLUMN IF NOT EXISTS birth_date date,
  ADD COLUMN IF NOT EXISTS work_address text;

-- Add year column to cars table
ALTER TABLE public.cars
  ADD COLUMN IF NOT EXISTS year integer;
