-- site_pages uses trigger_set_timestamps(), which reads/writes created_at.
-- This migration predates 20260801200000 (which creates site_pages), so it
-- only applies when the table already exists. The definitive repair for F1
-- installs is 20260821130000_site_pages_created_at_repair.sql.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'site_pages'
  ) THEN
    ALTER TABLE public.site_pages
      ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();
  END IF;
END $$;

COMMENT ON COLUMN public.site_pages.created_at IS
  'Row create time; required by public.trigger_set_timestamps().';
