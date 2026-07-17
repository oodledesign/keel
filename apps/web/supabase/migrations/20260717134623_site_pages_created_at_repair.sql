-- Repair: site_pages uses trigger_set_timestamps(), which reads/writes created_at.

ALTER TABLE public.site_pages
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();

COMMENT ON COLUMN public.site_pages.created_at IS
  'Row create time; required by public.trigger_set_timestamps().';
