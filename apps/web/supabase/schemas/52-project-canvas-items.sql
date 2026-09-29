-- Shared realtime project canvas. One row per canvas item so concurrent
-- editors never overwrite each other's items. Linked kinds (phase, task,
-- member, client, note) store only placement; their content is read live
-- from the source tables via `ref_id`.

CREATE TABLE IF NOT EXISTS public.project_canvas_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.accounts (id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES public.projects (id) ON DELETE CASCADE,
  kind text NOT NULL,
  ref_id uuid,
  x double precision NOT NULL DEFAULT 0,
  y double precision NOT NULL DEFAULT 0,
  w double precision,
  h double precision,
  z_index integer NOT NULL DEFAULT 0,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid DEFAULT auth.uid() REFERENCES auth.users (id) ON DELETE SET NULL,
  updated_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT project_canvas_items_kind_check CHECK (
    kind IN (
      'phase', 'task', 'member', 'client', 'note',
      'sticky', 'text', 'shape', 'frame', 'image', 'draw', 'connector'
    )
  ),
  CONSTRAINT project_canvas_items_data_object CHECK (jsonb_typeof(data) = 'object'),
  CONSTRAINT project_canvas_items_linked_ref CHECK (
    (kind IN ('phase', 'task', 'member', 'client', 'note')) = (ref_id IS NOT NULL)
  )
);

COMMENT ON TABLE public.project_canvas_items IS
  'Items on a project''s shared canvas. Linked kinds reference phases/tasks/members/clients/notes via ref_id.';

CREATE INDEX IF NOT EXISTS ix_project_canvas_items_project_id
  ON public.project_canvas_items (project_id);

CREATE INDEX IF NOT EXISTS ix_project_canvas_items_account_id
  ON public.project_canvas_items (account_id);

CREATE UNIQUE INDEX IF NOT EXISTS ux_project_canvas_items_linked
  ON public.project_canvas_items (project_id, kind, ref_id)
  WHERE ref_id IS NOT NULL;

DROP TRIGGER IF EXISTS project_canvas_items_set_timestamps ON public.project_canvas_items;
CREATE TRIGGER project_canvas_items_set_timestamps
  BEFORE INSERT OR UPDATE ON public.project_canvas_items
  FOR EACH ROW EXECUTE FUNCTION public.trigger_set_timestamps();

-- Access helpers (shared by table RLS and realtime channel authorization).

CREATE OR REPLACE FUNCTION public.can_view_project_canvas(p_project_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.projects p
    WHERE p.id = p_project_id
      AND (
        public.is_account_owner(p.account_id)
        OR (
          public.has_role_on_account(p.account_id)
          AND NOT public.is_client_on_account(p.account_id)
          AND (
            NOT public.is_contractor_on_account(p.account_id)
            OR public.contractor_assigned_to_project(p.id)
          )
        )
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.can_edit_project_canvas(p_account_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT public.is_account_owner(p_account_id)
    OR (
      public.has_permission(auth.uid(), p_account_id, 'jobs.edit'::public.app_permissions)
      AND NOT public.is_contractor_on_account(p_account_id)
    );
$$;

CREATE OR REPLACE FUNCTION public.can_join_project_canvas_topic(p_topic text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF p_topic IS NULL
    OR p_topic !~ '^project-canvas:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  THEN
    RETURN false;
  END IF;
  RETURN public.can_view_project_canvas(substr(p_topic, 16)::uuid);
END;
$$;

REVOKE ALL ON FUNCTION public.can_view_project_canvas(uuid) FROM public;
REVOKE ALL ON FUNCTION public.can_edit_project_canvas(uuid) FROM public;
REVOKE ALL ON FUNCTION public.can_join_project_canvas_topic(text) FROM public;
GRANT EXECUTE ON FUNCTION public.can_view_project_canvas(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_edit_project_canvas(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_join_project_canvas_topic(text) TO authenticated, service_role;

ALTER TABLE public.project_canvas_items ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_canvas_items TO authenticated, service_role;

DROP POLICY IF EXISTS project_canvas_items_select ON public.project_canvas_items;
CREATE POLICY project_canvas_items_select ON public.project_canvas_items
  FOR SELECT TO authenticated
  USING (public.can_view_project_canvas(project_id));

DROP POLICY IF EXISTS project_canvas_items_insert ON public.project_canvas_items;
CREATE POLICY project_canvas_items_insert ON public.project_canvas_items
  FOR INSERT TO authenticated
  WITH CHECK (
    public.can_edit_project_canvas(account_id)
    AND EXISTS (
      SELECT 1
      FROM public.projects p
      WHERE p.id = project_canvas_items.project_id
        AND p.account_id = project_canvas_items.account_id
        AND p.project_type = 'delivery'
    )
  );

DROP POLICY IF EXISTS project_canvas_items_update ON public.project_canvas_items;
CREATE POLICY project_canvas_items_update ON public.project_canvas_items
  FOR UPDATE TO authenticated
  USING (
    public.can_edit_project_canvas(account_id)
    AND public.can_view_project_canvas(project_id)
  )
  WITH CHECK (
    public.can_edit_project_canvas(account_id)
    AND EXISTS (
      SELECT 1
      FROM public.projects p
      WHERE p.id = project_canvas_items.project_id
        AND p.account_id = project_canvas_items.account_id
        AND p.project_type = 'delivery'
    )
  );

DROP POLICY IF EXISTS project_canvas_items_delete ON public.project_canvas_items;
CREATE POLICY project_canvas_items_delete ON public.project_canvas_items
  FOR DELETE TO authenticated
  USING (
    public.can_edit_project_canvas(account_id)
    AND public.can_view_project_canvas(project_id)
  );

-- Realtime: item changes + live linked data (tasks / phases).
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['project_canvas_items', 'tasks', 'project_phases']
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = t
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    END IF;
  END LOOP;
END $$;

-- Private broadcast/presence channel `project-canvas:<project_id>` for
-- cursors, live drag and who-is-here. Only users who can view the project.
DO $$
BEGIN
  IF to_regclass('realtime.messages') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS project_canvas_realtime_receive ON realtime.messages';
    EXECUTE $p$
      CREATE POLICY project_canvas_realtime_receive ON realtime.messages
        FOR SELECT TO authenticated
        USING (
          extension IN ('broadcast', 'presence')
          AND public.can_join_project_canvas_topic(realtime.topic())
        )
    $p$;
    EXECUTE 'DROP POLICY IF EXISTS project_canvas_realtime_send ON realtime.messages';
    EXECUTE $p$
      CREATE POLICY project_canvas_realtime_send ON realtime.messages
        FOR INSERT TO authenticated
        WITH CHECK (
          extension IN ('broadcast', 'presence')
          AND public.can_join_project_canvas_topic(realtime.topic())
        )
    $p$;
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
