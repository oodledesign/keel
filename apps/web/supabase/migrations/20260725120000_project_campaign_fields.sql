-- Campaign project trackers: custom columns per project + per-client field values.

-- Repair: ensure contractor helper exists (some remotes skipped 20260216000002).
CREATE OR REPLACE FUNCTION public.is_contractor_on_account(account_id uuid)
RETURNS boolean
SET search_path = ''
LANGUAGE sql
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.accounts_memberships
    WHERE public.accounts_memberships.account_id = is_contractor_on_account.account_id
      AND public.accounts_memberships.user_id = auth.uid()
      AND public.accounts_memberships.account_role = 'contractor'
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_contractor_on_account(uuid) TO authenticated;

-- Repair: legacy `projects` (business_id / client_org_id) predates CRM account-scoped projects.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'projects'
  ) THEN
    CREATE TABLE public.projects (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      account_id uuid NOT NULL REFERENCES public.accounts (id) ON DELETE CASCADE,
      name text NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );
  ELSE
    ALTER TABLE public.projects
      ADD COLUMN IF NOT EXISTS account_id uuid REFERENCES public.accounts (id) ON DELETE CASCADE;

    ALTER TABLE public.projects
      ADD COLUMN IF NOT EXISTS name text;

    ALTER TABLE public.projects
      ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();

    ALTER TABLE public.projects
      ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

    IF EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'projects'
        AND column_name = 'business_id'
    )
    AND EXISTS (
      SELECT 1
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name = 'businesses'
    )
    AND EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'businesses'
        AND column_name = 'account_id'
    ) THEN
      UPDATE public.projects AS p
      SET account_id = b.account_id
      FROM public.businesses AS b
      WHERE p.account_id IS NULL
        AND p.business_id = b.id
        AND b.account_id IS NOT NULL;
    END IF;

    IF EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'projects'
        AND column_name = 'title'
    ) THEN
      EXECUTE $sql$
        UPDATE public.projects
        SET name = title
        WHERE name IS NULL
          AND title IS NOT NULL
          AND btrim(title) <> ''
      $sql$;
    END IF;

    UPDATE public.projects
    SET name = 'Project'
    WHERE name IS NULL OR btrim(name) = '';

    UPDATE public.projects
    SET created_at = COALESCE(created_at, now())
    WHERE created_at IS NULL;

    UPDATE public.projects
    SET updated_at = COALESCE(updated_at, now())
    WHERE updated_at IS NULL;
  END IF;
END $$;

COMMENT ON TABLE public.projects IS
  'Projects belong to an account. Contractors see only projects they are assigned to.';

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'projects'
      AND column_name = 'account_id'
  ) THEN
    CREATE INDEX IF NOT EXISTS ix_projects_account_id ON public.projects (account_id);
  END IF;
END $$;

-- Repair: remote DBs may have `projects` without assignment infrastructure from 20260216000002.
CREATE TABLE IF NOT EXISTS public.project_assignments (
  project_id uuid NOT NULL REFERENCES public.projects (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  PRIMARY KEY (project_id, user_id)
);

COMMENT ON TABLE public.project_assignments IS
  'Assigns users (e.g. contractors) to projects. Used to scope contractor access.';

CREATE INDEX IF NOT EXISTS ix_project_assignments_user_id
  ON public.project_assignments (user_id);

CREATE OR REPLACE FUNCTION public.contractor_assigned_to_project(project_id uuid)
RETURNS boolean
SET search_path = ''
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.project_assignments
    WHERE public.project_assignments.project_id = contractor_assigned_to_project.project_id
      AND public.project_assignments.user_id = auth.uid()
  );
$$;

GRANT EXECUTE ON FUNCTION public.contractor_assigned_to_project(uuid) TO authenticated;

ALTER TABLE public.project_assignments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS project_assignments_select ON public.project_assignments;
CREATE POLICY project_assignments_select ON public.project_assignments
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.projects p
      WHERE p.id = project_assignments.project_id
        AND public.has_role_on_account (p.account_id)
        AND (
          NOT public.is_contractor_on_account (p.account_id)
          OR public.contractor_assigned_to_project (p.id)
        )
    )
  );

DROP POLICY IF EXISTS project_assignments_insert ON public.project_assignments;
CREATE POLICY project_assignments_insert ON public.project_assignments
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.projects p
      WHERE p.id = project_assignments.project_id
        AND public.has_permission (auth.uid (), p.account_id, 'jobs.edit'::public.app_permissions)
        AND NOT public.is_contractor_on_account (p.account_id)
    )
  );

DROP POLICY IF EXISTS project_assignments_delete ON public.project_assignments;
CREATE POLICY project_assignments_delete ON public.project_assignments
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.projects p
      WHERE p.id = project_assignments.project_id
        AND public.has_permission (auth.uid (), p.account_id, 'jobs.edit'::public.app_permissions)
        AND NOT public.is_contractor_on_account (p.account_id)
    )
  );

GRANT SELECT, INSERT, DELETE ON public.project_assignments TO authenticated;

CREATE TABLE IF NOT EXISTS public.project_field_definitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.accounts (id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES public.projects (id) ON DELETE CASCADE,
  field_key text NOT NULL,
  label text NOT NULL,
  field_type text NOT NULL,
  options jsonb NOT NULL DEFAULT '{}'::jsonb,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT project_field_definitions_type_check CHECK (
    field_type IN (
      'text',
      'checkbox',
      'url',
      'client_link',
      'project_link',
      'select',
      'currency',
      'date',
      'number',
      'email'
    )
  ),
  CONSTRAINT project_field_definitions_key_check CHECK (
    field_key ~ '^[a-z][a-z0-9_]*$'
  ),
  UNIQUE (project_id, field_key)
);

COMMENT ON TABLE public.project_field_definitions IS
  'Custom column definitions for a campaign project (spreadsheet-style trackers).';

CREATE INDEX IF NOT EXISTS ix_project_field_definitions_project_id
  ON public.project_field_definitions (project_id, sort_order);

CREATE TABLE IF NOT EXISTS public.project_client_field_values (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.accounts (id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES public.projects (id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES public.clients (id) ON DELETE CASCADE,
  values jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT project_client_field_values_json_check CHECK (
    jsonb_typeof(values) = 'object'
  ),
  UNIQUE (project_id, client_id)
);

COMMENT ON TABLE public.project_client_field_values IS
  'Per-client custom field values for a campaign project. Keys are project_field_definitions.id.';

CREATE INDEX IF NOT EXISTS ix_project_client_field_values_project_id
  ON public.project_client_field_values (project_id);

CREATE INDEX IF NOT EXISTS ix_project_client_field_values_client_id
  ON public.project_client_field_values (client_id);

DROP TRIGGER IF EXISTS project_field_definitions_set_timestamps ON public.project_field_definitions;
CREATE TRIGGER project_field_definitions_set_timestamps
  BEFORE INSERT OR UPDATE ON public.project_field_definitions
  FOR EACH ROW EXECUTE FUNCTION public.trigger_set_timestamps();

DROP TRIGGER IF EXISTS project_client_field_values_set_timestamps ON public.project_client_field_values;
CREATE TRIGGER project_client_field_values_set_timestamps
  BEFORE INSERT OR UPDATE ON public.project_client_field_values
  FOR EACH ROW EXECUTE FUNCTION public.trigger_set_timestamps();

ALTER TABLE public.project_field_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_client_field_values ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_field_definitions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_client_field_values TO authenticated;

-- field definitions: same visibility as parent project
DROP POLICY IF EXISTS project_field_definitions_select ON public.project_field_definitions;
CREATE POLICY project_field_definitions_select ON public.project_field_definitions
  FOR SELECT TO authenticated
  USING (
    public.has_role_on_account (account_id)
    AND (
      NOT public.is_contractor_on_account (account_id)
      OR public.contractor_assigned_to_project (project_id)
    )
  );

DROP POLICY IF EXISTS project_field_definitions_insert ON public.project_field_definitions;
CREATE POLICY project_field_definitions_insert ON public.project_field_definitions
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_permission (auth.uid (), account_id, 'jobs.edit'::public.app_permissions)
    AND NOT public.is_contractor_on_account (account_id)
    AND EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_field_definitions.project_id
        AND p.account_id = project_field_definitions.account_id
    )
  );

DROP POLICY IF EXISTS project_field_definitions_update ON public.project_field_definitions;
CREATE POLICY project_field_definitions_update ON public.project_field_definitions
  FOR UPDATE TO authenticated
  USING (
    public.has_permission (auth.uid (), account_id, 'jobs.edit'::public.app_permissions)
    AND NOT public.is_contractor_on_account (account_id)
  )
  WITH CHECK (
    public.has_permission (auth.uid (), account_id, 'jobs.edit'::public.app_permissions)
    AND NOT public.is_contractor_on_account (account_id)
  );

DROP POLICY IF EXISTS project_field_definitions_delete ON public.project_field_definitions;
CREATE POLICY project_field_definitions_delete ON public.project_field_definitions
  FOR DELETE TO authenticated
  USING (
    public.has_permission (auth.uid (), account_id, 'jobs.edit'::public.app_permissions)
    AND NOT public.is_contractor_on_account (account_id)
  );

-- client field values: read with project; write with jobs.edit
DROP POLICY IF EXISTS project_client_field_values_select ON public.project_client_field_values;
CREATE POLICY project_client_field_values_select ON public.project_client_field_values
  FOR SELECT TO authenticated
  USING (
    public.has_role_on_account (account_id)
    AND (
      NOT public.is_contractor_on_account (account_id)
      OR public.contractor_assigned_to_project (project_id)
    )
  );

DROP POLICY IF EXISTS project_client_field_values_insert ON public.project_client_field_values;
CREATE POLICY project_client_field_values_insert ON public.project_client_field_values
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_permission (auth.uid (), account_id, 'jobs.edit'::public.app_permissions)
    AND NOT public.is_contractor_on_account (account_id)
  );

DROP POLICY IF EXISTS project_client_field_values_update ON public.project_client_field_values;
CREATE POLICY project_client_field_values_update ON public.project_client_field_values
  FOR UPDATE TO authenticated
  USING (
    public.has_permission (auth.uid (), account_id, 'jobs.edit'::public.app_permissions)
    AND NOT public.is_contractor_on_account (account_id)
  )
  WITH CHECK (
    public.has_permission (auth.uid (), account_id, 'jobs.edit'::public.app_permissions)
    AND NOT public.is_contractor_on_account (account_id)
  );

DROP POLICY IF EXISTS project_client_field_values_delete ON public.project_client_field_values;
CREATE POLICY project_client_field_values_delete ON public.project_client_field_values
  FOR DELETE TO authenticated
  USING (
    public.has_permission (auth.uid (), account_id, 'jobs.edit'::public.app_permissions)
    AND NOT public.is_contractor_on_account (account_id)
  );

NOTIFY pgrst, 'reload schema';
