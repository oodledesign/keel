-- Project mode: ongoing (no deadline) + phased vs progress-only boards.

ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS is_ongoing boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_phased boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.projects.is_ongoing IS
  'When true, the project has no definitive deadline (due_date should be null).';
COMMENT ON COLUMN public.projects.is_phased IS
  'When true, Phase board view is available. When false, Progress-only (default).';
