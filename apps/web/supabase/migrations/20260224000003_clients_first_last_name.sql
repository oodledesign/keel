-- Add first_name and last_name to clients; keep display_name for backward compatibility (computed or backfilled).

ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS first_name text,
  ADD COLUMN IF NOT EXISTS last_name text;

-- Backfill from display_name for existing rows
UPDATE public.clients
SET
  first_name = trim(split_part(display_name, ' ', 1)),
  last_name = nullif(trim(substring(display_name from position(' ' in display_name) + 1)), '')
WHERE first_name IS NULL AND display_name IS NOT NULL AND display_name <> '';

-- Where we only had one part, put it in first_name
UPDATE public.clients
SET first_name = coalesce(first_name, display_name)
WHERE first_name IS NULL AND display_name IS NOT NULL;

COMMENT ON COLUMN public.clients.first_name IS 'Client first name';
COMMENT ON COLUMN public.clients.last_name IS 'Client last name';
