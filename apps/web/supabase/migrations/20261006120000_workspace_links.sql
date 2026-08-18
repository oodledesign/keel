-- Saved web links alongside notes and files (title, URL, description + cached preview).

CREATE TABLE IF NOT EXISTS public.workspace_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.accounts (id) ON DELETE CASCADE,
  title text NOT NULL DEFAULT '',
  url text NOT NULL,
  description text NOT NULL DEFAULT '',
  favicon_url text,
  og_image_url text,
  is_pinned boolean NOT NULL DEFAULT false,
  project_id uuid,
  client_id uuid,
  client_org_id uuid,
  property_id uuid,
  task_id uuid,
  created_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT workspace_links_url_http CHECK (url ~* '^https?://'),
  CONSTRAINT workspace_links_title_len CHECK (char_length(title) <= 500),
  CONSTRAINT workspace_links_url_len CHECK (char_length(url) <= 2048),
  CONSTRAINT workspace_links_description_len CHECK (char_length(description) <= 4000)
);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'projects'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'workspace_links_project_id_fkey'
  ) THEN
    ALTER TABLE public.workspace_links
      ADD CONSTRAINT workspace_links_project_id_fkey
      FOREIGN KEY (project_id) REFERENCES public.projects (id) ON DELETE SET NULL;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'clients'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'workspace_links_client_id_fkey'
  ) THEN
    ALTER TABLE public.workspace_links
      ADD CONSTRAINT workspace_links_client_id_fkey
      FOREIGN KEY (client_id) REFERENCES public.clients (id) ON DELETE SET NULL;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'client_orgs'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'workspace_links_client_org_id_fkey'
  ) THEN
    ALTER TABLE public.workspace_links
      ADD CONSTRAINT workspace_links_client_org_id_fkey
      FOREIGN KEY (client_org_id) REFERENCES public.client_orgs (id) ON DELETE SET NULL;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'properties'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'workspace_links_property_id_fkey'
  ) THEN
    ALTER TABLE public.workspace_links
      ADD CONSTRAINT workspace_links_property_id_fkey
      FOREIGN KEY (property_id) REFERENCES public.properties (id) ON DELETE SET NULL;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'tasks'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'workspace_links_task_id_fkey'
  ) THEN
    ALTER TABLE public.workspace_links
      ADD CONSTRAINT workspace_links_task_id_fkey
      FOREIGN KEY (task_id) REFERENCES public.tasks (id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS ix_workspace_links_account_updated
  ON public.workspace_links (account_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS ix_workspace_links_account_pinned
  ON public.workspace_links (account_id, is_pinned)
  WHERE is_pinned = true;

CREATE INDEX IF NOT EXISTS ix_workspace_links_account_project
  ON public.workspace_links (account_id, project_id)
  WHERE project_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS ix_workspace_links_account_client
  ON public.workspace_links (account_id, client_id)
  WHERE client_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS ix_workspace_links_account_property
  ON public.workspace_links (account_id, property_id)
  WHERE property_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS ix_workspace_links_account_task
  ON public.workspace_links (account_id, task_id)
  WHERE task_id IS NOT NULL;

COMMENT ON TABLE public.workspace_links IS
  'Account-scoped saved links (title, URL, description) with cached favicon and Open Graph image.';

DROP TRIGGER IF EXISTS workspace_links_set_timestamps ON public.workspace_links;
CREATE TRIGGER workspace_links_set_timestamps
  BEFORE INSERT OR UPDATE ON public.workspace_links
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_set_timestamps();

ALTER TABLE public.workspace_links ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.workspace_links FROM authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.workspace_links TO authenticated, service_role;

DROP POLICY IF EXISTS workspace_links_select ON public.workspace_links;
CREATE POLICY workspace_links_select ON public.workspace_links
  FOR SELECT TO authenticated
  USING (public.has_role_on_account(account_id));

DROP POLICY IF EXISTS workspace_links_insert ON public.workspace_links;
CREATE POLICY workspace_links_insert ON public.workspace_links
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role_on_account(account_id));

DROP POLICY IF EXISTS workspace_links_update ON public.workspace_links;
CREATE POLICY workspace_links_update ON public.workspace_links
  FOR UPDATE TO authenticated
  USING (public.has_role_on_account(account_id))
  WITH CHECK (public.has_role_on_account(account_id));

DROP POLICY IF EXISTS workspace_links_delete ON public.workspace_links;
CREATE POLICY workspace_links_delete ON public.workspace_links
  FOR DELETE TO authenticated
  USING (public.has_role_on_account(account_id));

NOTIFY pgrst, 'reload schema';
