-- Project guests can view their project's canvas: its items, phases, project
-- notes and files, canvas images, comments and the live cursor channel.
-- They comment only with the `comment` capability and never edit canvas
-- items. Team members, contacts and the client stay hidden: this adds no
-- policies on project_assignments, project_contacts, contacts or clients.

CREATE OR REPLACE FUNCTION public.can_guest_view_project_content(
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
      AND public.is_accepted_project_guest(p.id)
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

REVOKE ALL ON FUNCTION public.can_guest_view_project_content(uuid, uuid, uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.can_guest_view_project_content(uuid, uuid, uuid)
  TO authenticated, service_role;

-- Canvas items: read only.
DROP POLICY IF EXISTS project_canvas_items_select_as_guest ON public.project_canvas_items;
CREATE POLICY project_canvas_items_select_as_guest ON public.project_canvas_items
  FOR SELECT TO authenticated
  USING (public.is_accepted_project_guest(project_id));

-- Phases: read only.
DROP POLICY IF EXISTS project_phases_select_as_project_guest ON public.project_phases;
CREATE POLICY project_phases_select_as_project_guest ON public.project_phases
  FOR SELECT TO authenticated
  USING (public.is_accepted_project_guest(project_id));

-- Project and phase notes / files: read only.
DROP POLICY IF EXISTS notes_select_as_project_guest ON public.notes;
CREATE POLICY notes_select_as_project_guest ON public.notes
  FOR SELECT TO authenticated
  USING (public.can_guest_view_project_content(account_id, project_id, phase_id));

DROP POLICY IF EXISTS docs_select_as_project_guest ON public.docs;
CREATE POLICY docs_select_as_project_guest ON public.docs
  FOR SELECT TO authenticated
  USING (public.can_guest_view_project_content(account_id, project_id, phase_id));

-- Canvas comments: read all; write, edit, resolve and delete their own.
DROP POLICY IF EXISTS project_canvas_comments_select_as_guest ON public.project_canvas_comments;
CREATE POLICY project_canvas_comments_select_as_guest ON public.project_canvas_comments
  FOR SELECT TO authenticated
  USING (public.is_accepted_project_guest(project_id));

DROP POLICY IF EXISTS project_canvas_comments_insert_as_guest ON public.project_canvas_comments;
CREATE POLICY project_canvas_comments_insert_as_guest ON public.project_canvas_comments
  FOR INSERT TO authenticated
  WITH CHECK (
    author_id = (SELECT auth.uid())
    AND public.has_project_guest_capability(project_id, 'comment')
    AND EXISTS (
      SELECT 1
      FROM public.projects p
      WHERE p.id = project_canvas_comments.project_id
        AND p.account_id = project_canvas_comments.account_id
    )
  );

DROP POLICY IF EXISTS project_canvas_comments_update_as_guest ON public.project_canvas_comments;
CREATE POLICY project_canvas_comments_update_as_guest ON public.project_canvas_comments
  FOR UPDATE TO authenticated
  USING (
    author_id = (SELECT auth.uid())
    AND public.has_project_guest_capability(project_id, 'comment')
  )
  WITH CHECK (
    author_id = (SELECT auth.uid())
    AND public.has_project_guest_capability(project_id, 'comment')
  );

DROP POLICY IF EXISTS project_canvas_comments_delete_as_guest ON public.project_canvas_comments;
CREATE POLICY project_canvas_comments_delete_as_guest ON public.project_canvas_comments
  FOR DELETE TO authenticated
  USING (
    author_id = (SELECT auth.uid())
    AND public.is_accepted_project_guest(project_id)
  );

-- Canvas images: guests may read, never upload or delete.
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

  IF NOT p_edit AND public.is_accepted_project_guest(v_project) THEN
    RETURN true;
  END IF;

  IF NOT public.can_view_project_canvas(v_project) THEN
    RETURN false;
  END IF;

  RETURN NOT p_edit OR public.can_edit_project_canvas(v_account);
END;
$$;

-- Guests join the channel for presence and to receive live changes, but only
-- the team may broadcast: remote item broadcasts are merged into everyone's
-- canvas, so guests must not be able to send them.
CREATE OR REPLACE FUNCTION public.can_join_project_canvas_topic(p_topic text)
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
    OR public.is_accepted_project_guest(v_project);
END;
$$;

CREATE OR REPLACE FUNCTION public.can_broadcast_project_canvas_topic(p_topic text)
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

REVOKE ALL ON FUNCTION public.can_broadcast_project_canvas_topic(text) FROM public;
GRANT EXECUTE ON FUNCTION public.can_broadcast_project_canvas_topic(text)
  TO authenticated, service_role;

DO $$
BEGIN
  IF to_regclass('realtime.messages') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS project_canvas_realtime_send ON realtime.messages';
    EXECUTE $p$
      CREATE POLICY project_canvas_realtime_send ON realtime.messages
        FOR INSERT TO authenticated
        WITH CHECK (
          (
            extension = 'presence'
            AND public.can_join_project_canvas_topic(realtime.topic())
          )
          OR (
            extension = 'broadcast'
            AND public.can_broadcast_project_canvas_topic(realtime.topic())
          )
        )
    $p$;
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
