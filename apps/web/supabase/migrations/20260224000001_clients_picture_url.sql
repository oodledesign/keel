-- Add profile image URL to clients for portal avatar support
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS picture_url text;

