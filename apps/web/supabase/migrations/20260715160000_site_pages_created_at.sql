-- site_pages uses trigger_set_timestamps(), which reads/writes created_at.
-- The F1 migration only added updated_at, so publish INSERT/UPDATE failed with:
--   record "new" has no field "created_at" (42703)

ALTER TABLE public.site_pages
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();

COMMENT ON COLUMN public.site_pages.created_at IS
  'Row create time; required by public.trigger_set_timestamps().';
