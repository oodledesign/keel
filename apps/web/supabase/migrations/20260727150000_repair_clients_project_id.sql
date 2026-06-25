-- Remote drift: Keel CRM clients table (20260314000000) omitted project_id.
-- Campaign trackers link clients via clients.project_id; delivery uses projects.client_id.

ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS project_id uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'clients_project_id_fkey'
  ) THEN
    ALTER TABLE public.clients
      ADD CONSTRAINT clients_project_id_fkey
      FOREIGN KEY (project_id) REFERENCES public.projects (id) ON DELETE SET NULL;
  END IF;
EXCEPTION
  WHEN undefined_table THEN
    RAISE NOTICE 'clients_project_id_fkey skipped: projects table missing';
END $$;

CREATE INDEX IF NOT EXISTS ix_clients_project_id
  ON public.clients (project_id)
  WHERE project_id IS NOT NULL;

COMMENT ON COLUMN public.clients.project_id IS
  'Campaign tracker membership. Delivery projects use projects.client_id for the primary client link.';

NOTIFY pgrst, 'reload schema';
