-- Optional project link on client_subscriptions so retainers are managed
-- on the project. Credits stay on project_retainers (unchanged).

ALTER TABLE public.client_subscriptions
  ADD COLUMN IF NOT EXISTS project_id uuid REFERENCES public.projects (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS ix_client_subscriptions_project_id
  ON public.client_subscriptions (project_id);

COMMENT ON COLUMN public.client_subscriptions.project_id IS
  'Project this retainer is managed on. Null for hosting plans and legacy client-level retainers.';
