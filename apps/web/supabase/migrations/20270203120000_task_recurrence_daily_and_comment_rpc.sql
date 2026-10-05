-- 1) Recurring tasks can repeat every day or every weekday.
ALTER TABLE public.task_recurring_series
  DROP CONSTRAINT IF EXISTS task_recurring_series_frequency_check;
ALTER TABLE public.task_recurring_series
  ADD CONSTRAINT task_recurring_series_frequency_check CHECK (
    frequency IN (
      'daily', 'weekdays', 'weekly', 'fortnightly', 'monthly', 'quarterly', 'yearly'
    )
  );

-- Recurring tasks can land in a phase and be assigned to a teammate.
ALTER TABLE public.task_recurring_series
  ADD COLUMN IF NOT EXISTS phase_id uuid REFERENCES public.project_phases (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS assignee_user_id uuid REFERENCES auth.users (id) ON DELETE SET NULL;

-- 2) Add a canvas comment and tell the people mentioned in it. Notifications
-- can only be inserted by the service role, so this runs as the definer and
-- re-checks everything itself: the caller must be able to see the project,
-- and only members of the project's workspace are notified.
CREATE OR REPLACE FUNCTION public.add_project_canvas_comment(
  p_project_id uuid,
  p_item_id uuid,
  p_body text,
  p_mentions uuid[] DEFAULT '{}'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_account uuid;
  v_title text;
  v_slug text;
  v_author text;
  v_comment uuid;
  v_mentions uuid[];
  v_member uuid;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;
  IF NOT public.can_view_project_canvas(p_project_id) THEN
    RAISE EXCEPTION 'You do not have access to this project';
  END IF;

  SELECT p.account_id, coalesce(nullif(btrim(p.title), ''), nullif(btrim(p.name), ''), 'a project'), a.slug
    INTO v_account, v_title, v_slug
  FROM public.projects p
  JOIN public.accounts a ON a.id = p.account_id
  WHERE p.id = p_project_id;
  IF v_account IS NULL THEN
    RAISE EXCEPTION 'Project not found';
  END IF;

  IF p_body IS NULL OR char_length(btrim(p_body)) = 0 THEN
    RAISE EXCEPTION 'Comment cannot be empty';
  END IF;

  SELECT coalesce(array_agg(DISTINCT m.user_id), '{}')
    INTO v_mentions
  FROM public.accounts_memberships m
  WHERE m.account_id = v_account
    AND m.user_id = ANY (coalesce(p_mentions, '{}'))
    AND m.user_id <> v_user;

  INSERT INTO public.project_canvas_comments
    (account_id, project_id, item_id, body, mentions, author_id)
  VALUES
    (v_account, p_project_id, p_item_id, btrim(p_body), v_mentions, v_user)
  RETURNING id INTO v_comment;

  SELECT coalesce(nullif(btrim(name), ''), 'Someone') INTO v_author
  FROM public.accounts WHERE id = v_user;

  FOREACH v_member IN ARRAY v_mentions LOOP
    INSERT INTO public.notifications (account_id, type, channel, body, link)
    VALUES (
      v_member,
      'info',
      'in_app',
      left(
        coalesce(v_author, 'Someone') || ' mentioned you on the ' || v_title
          || ' canvas: “' || left(regexp_replace(btrim(p_body), '\s+', ' ', 'g'), 140) || '”',
        5000
      ),
      left('/app/' || v_slug || '/projects/' || p_project_id || '?view=canvas&canvasItem=' || p_item_id, 255)
    );
  END LOOP;

  RETURN v_comment;
END;
$$;

REVOKE ALL ON FUNCTION public.add_project_canvas_comment(uuid, uuid, text, uuid[]) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.add_project_canvas_comment(uuid, uuid, text, uuid[]) TO authenticated;

NOTIFY pgrst, 'reload schema';
