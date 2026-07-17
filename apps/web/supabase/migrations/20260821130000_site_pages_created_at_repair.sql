-- Repair: site_pages was created in 20260801200000 without created_at, but
-- trigger_set_timestamps() always reads/writes NEW.created_at on INSERT.
-- The earlier 20260715160000 migration predates the table and is a no-op on
-- fresh installs, so publish INSERTs fail with PostgREST 400 until this runs.

ALTER TABLE public.site_pages
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();

COMMENT ON COLUMN public.site_pages.created_at IS
  'Row create time; required by public.trigger_set_timestamps().';
