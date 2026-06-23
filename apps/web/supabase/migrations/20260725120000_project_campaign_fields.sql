-- Campaign project trackers: custom columns per project + per-client field values.

-- Remote DBs may be missing this helper if an earlier migration was skipped or repaired.
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
    public.has_permission (auth.uid (), account_id, 'projects.edit'::public.app_permissions)
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
    public.has_permission (auth.uid (), account_id, 'projects.edit'::public.app_permissions)
    AND NOT public.is_contractor_on_account (account_id)
  )
  WITH CHECK (
    public.has_permission (auth.uid (), account_id, 'projects.edit'::public.app_permissions)
    AND NOT public.is_contractor_on_account (account_id)
  );

DROP POLICY IF EXISTS project_field_definitions_delete ON public.project_field_definitions;
CREATE POLICY project_field_definitions_delete ON public.project_field_definitions
  FOR DELETE TO authenticated
  USING (
    public.has_permission (auth.uid (), account_id, 'projects.edit'::public.app_permissions)
    AND NOT public.is_contractor_on_account (account_id)
  );

-- client field values: read with project; write with projects.edit
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
    public.has_permission (auth.uid (), account_id, 'projects.edit'::public.app_permissions)
    AND NOT public.is_contractor_on_account (account_id)
  );

DROP POLICY IF EXISTS project_client_field_values_update ON public.project_client_field_values;
CREATE POLICY project_client_field_values_update ON public.project_client_field_values
  FOR UPDATE TO authenticated
  USING (
    public.has_permission (auth.uid (), account_id, 'projects.edit'::public.app_permissions)
    AND NOT public.is_contractor_on_account (account_id)
  )
  WITH CHECK (
    public.has_permission (auth.uid (), account_id, 'projects.edit'::public.app_permissions)
    AND NOT public.is_contractor_on_account (account_id)
  );

DROP POLICY IF EXISTS project_client_field_values_delete ON public.project_client_field_values;
CREATE POLICY project_client_field_values_delete ON public.project_client_field_values
  FOR DELETE TO authenticated
  USING (
    public.has_permission (auth.uid (), account_id, 'projects.edit'::public.app_permissions)
    AND NOT public.is_contractor_on_account (account_id)
  );

NOTIFY pgrst, 'reload schema';
