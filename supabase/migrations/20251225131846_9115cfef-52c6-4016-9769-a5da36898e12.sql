-- Drop the foreign key constraint on subscriptions.user_id
ALTER TABLE public.subscriptions DROP CONSTRAINT IF EXISTS subscriptions_user_id_fkey;

-- Make user_id nullable for guest subscriptions
ALTER TABLE public.subscriptions ALTER COLUMN user_id DROP NOT NULL;