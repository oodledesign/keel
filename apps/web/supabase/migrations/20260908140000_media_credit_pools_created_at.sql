-- media_credit_pools only has updated_at; trigger_set_timestamps requires created_at.
-- Add created_at and keep the shared timestamps trigger working.

ALTER TABLE public.media_credit_pools
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();
