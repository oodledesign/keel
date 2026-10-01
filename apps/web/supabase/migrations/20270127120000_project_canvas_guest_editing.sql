-- Guests with the `edit_canvas` permission can add to and edit a project's
-- canvas: notes, text, drawings, images, files and layout. They still never
-- touch people cards (members, contacts, client), tasks beyond their own, or
-- anything outside the one project they were invited to.
--
-- Also adds the `metric` canvas kind (big figures with targets).

-- ---------------------------------------------------------------------------
-- Canvas item kinds
-- ---------------------------------------------------------------------------

ALTER TABLE public.project_canvas_items
  DROP CONSTRAINT IF EXISTS project_canvas_items_kind_check;
ALTER TABLE public.project_canvas_items
  ADD CONSTRAINT project_canvas_items_kind_check CHECK (
    kind IN (
      'phase', 'task', 'member', 'client', 'note', 'contact', 'doc',
      'sticky', 'text', 'shape', 'frame', 'image', 'link', 'draw',
      'timeline', 'metric', 'connector'
    )
  );

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.can_guest_edit_project_canvas(
  p_account_id uuid,
  p_project_id uuid
)
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
      AND p.account_id = p_account_id
      AND p.project_type = 'delivery'
      AND public.has_project_guest_capability(p.id, 'edit_canvas')
  );
$$;

-- Notes and docs sit on the project, or on one of its phases.
CREATE OR REPLACE FUNCTION public.can_guest_edit_project_content(
  p_account_id uuid,
  p_project_id uuid,
  p_phase_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.projects p
    WHERE p.account_id = p_account_id
      AND p.project_type = 'delivery'
      AND public.has_project_guest_capability(p.id, 'edit_canvas')
      AND (
        p.id = p_project_id
        OR (
          p_project_id IS NULL
          AND EXISTS (
            SELECT 1
            FROM public.project_phases ph
            WHERE ph.id = p_phase_id
              AND ph.project_id = p.id
          )
        )
      )
  );
$$;

REVOKE ALL ON FUNCTION public.can_guest_edit_project_canvas(uuid, uuid) FROM public;
REVOKE ALL ON FUNCTION public.can_guest_edit_project_content(uuid, uuid, uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.can_guest_edit_project_canvas(uuid, uuid)
  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_guest_edit_project_content(uuid, uuid, uuid)
  TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Canvas items: everything except people cards
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS project_canvas_items_insert_as_guest ON public.project_canvas_items;
CREATE POLICY project_canvas_items_insert_as_guest ON public.project_canvas_items
  FOR INSERT TO authenticated
  WITH CHECK (
    kind NOT IN ('member', 'client', 'contact')
    AND public.can_guest_edit_project_canvas(account_id, project_id)
  );

DROP POLICY IF EXISTS project_canvas_items_update_as_guest ON public.project_canvas_items;
CREATE POLICY project_canvas_items_update_as_guest ON public.project_canvas_items
  FOR UPDATE TO authenticated
  USING (
    kind NOT IN ('member', 'client', 'contact')
    AND public.can_guest_edit_project_canvas(account_id, project_id)
  )
  WITH CHECK (
    kind NOT IN ('member', 'client', 'contact')
    AND public.can_guest_edit_project_canvas(account_id, project_id)
  );

DROP POLICY IF EXISTS project_canvas_items_delete_as_guest ON public.project_canvas_items;
CREATE POLICY project_canvas_items_delete_as_guest ON public.project_canvas_items
  FOR DELETE TO authenticated
  USING (
    kind NOT IN ('member', 'client', 'contact')
    AND public.can_guest_edit_project_canvas(account_id, project_id)
  );

-- ---------------------------------------------------------------------------
-- Project notes
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS notes_insert_as_project_guest ON public.notes;
CREATE POLICY notes_insert_as_project_guest ON public.notes
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = (SELECT auth.uid())
    AND project_id IS NOT NULL
    AND phase_id IS NULL
    AND public.can_guest_edit_project_canvas(account_id, project_id)
  );

DROP POLICY IF EXISTS notes_update_as_project_guest ON public.notes;
CREATE POLICY notes_update_as_project_guest ON public.notes
  FOR UPDATE TO authenticated
  USING (public.can_guest_edit_project_content(account_id, project_id, phase_id))
  WITH CHECK (public.can_guest_edit_project_content(account_id, project_id, phase_id));

-- ---------------------------------------------------------------------------
-- Canvas image storage: editing guests can upload and replace images
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.can_access_project_canvas_object(
  p_name text,
  p_edit boolean
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uuid constant text :=
    '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
  v_parts text[] := storage.foldername(p_name);
  v_account uuid;
  v_project uuid;
BEGIN
  IF coalesce(array_length(v_parts, 1), 0) <> 2
    OR v_parts[1] !~ v_uuid
    OR v_parts[2] !~ v_uuid
  THEN
    RETURN false;
  END IF;

  v_account := v_parts[1]::uuid;
  v_project := v_parts[2]::uuid;

  IF NOT EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id = v_project AND p.account_id = v_account
  ) THEN
    RETURN false;
  END IF;

  IF public.is_accepted_project_guest(v_project)
    AND (
      NOT p_edit
      OR public.can_guest_edit_project_canvas(v_account, v_project)
    )
  THEN
    RETURN true;
  END IF;

  IF NOT public.can_view_project_canvas(v_project) THEN
    RETURN false;
  END IF;

  RETURN NOT p_edit OR public.can_edit_project_canvas(v_account);
END;
$$;

-- ---------------------------------------------------------------------------
-- Realtime: editing guests broadcast their changes to everyone on the canvas
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.can_broadcast_project_canvas_topic(p_topic text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_project uuid;
BEGIN
  IF p_topic IS NULL
    OR p_topic !~ '^project-canvas:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  THEN
    RETURN false;
  END IF;
  v_project := substr(p_topic, 16)::uuid;
  RETURN public.can_view_project_canvas(v_project)
    OR public.has_project_guest_capability(v_project, 'edit_canvas');
END;
$$;

-- ---------------------------------------------------------------------------
-- Guests can edit rows but not re-home or re-label them
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.guard_project_guest_row_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF TG_TABLE_NAME = 'project_canvas_items' THEN
    IF public.is_accepted_project_guest(OLD.project_id)
      AND NOT public.can_edit_project_canvas(OLD.account_id)
      AND (
        NEW.project_id IS DISTINCT FROM OLD.project_id
        OR NEW.account_id IS DISTINCT FROM OLD.account_id
        OR NEW.kind IS DISTINCT FROM OLD.kind
        OR NEW.ref_id IS DISTINCT FROM OLD.ref_id
      )
    THEN
      RAISE EXCEPTION 'Guests cannot change what a canvas item is'
        USING ERRCODE = '42501';
    END IF;
  ELSIF OLD.project_id IS NOT NULL
    AND public.is_accepted_project_guest(OLD.project_id)
    AND NOT public.can_edit_project_canvas(OLD.account_id)
    AND (
      NEW.project_id IS DISTINCT FROM OLD.project_id
      OR NEW.account_id IS DISTINCT FROM OLD.account_id
      OR NEW.user_id IS DISTINCT FROM OLD.user_id
    )
  THEN
    RAISE EXCEPTION 'Guests cannot move or reassign this note'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.guard_project_guest_row_update() FROM public;

DROP TRIGGER IF EXISTS guard_guest_canvas_item_update ON public.project_canvas_items;
CREATE TRIGGER guard_guest_canvas_item_update
  BEFORE UPDATE ON public.project_canvas_items
  FOR EACH ROW EXECUTE FUNCTION public.guard_project_guest_row_update();

DROP TRIGGER IF EXISTS guard_guest_note_update ON public.notes;
CREATE TRIGGER guard_guest_note_update
  BEFORE UPDATE ON public.notes
  FOR EACH ROW EXECUTE FUNCTION public.guard_project_guest_row_update();

NOTIFY pgrst, 'reload schema';
