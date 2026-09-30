-- Comment threads on canvas items (with @mentions).

CREATE TABLE IF NOT EXISTS public.project_canvas_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.accounts (id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES public.projects (id) ON DELETE CASCADE,
  -- Soft link: canvas items are deleted and re-created by undo / redo.
  item_id uuid NOT NULL,
  body text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 4000),
  mentions uuid[] NOT NULL DEFAULT '{}' CHECK (cardinality(mentions) <= 20),
  author_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users (id) ON DELETE CASCADE,
  resolved_at timestamptz,
  resolved_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_project_canvas_comments_item
  ON public.project_canvas_comments (project_id, item_id, created_at);
CREATE INDEX IF NOT EXISTS ix_project_canvas_comments_account
  ON public.project_canvas_comments (account_id);

-- Project must be in the account; only the author edits the text; resolving
-- is stamped with whoever did it.
CREATE OR REPLACE FUNCTION public.project_canvas_comments_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = NEW.project_id AND p.account_id = NEW.account_id
    ) THEN
      RAISE EXCEPTION 'Project does not belong to this account';
    END IF;
    NEW.resolved_at := NULL;
    NEW.resolved_by := NULL;
  ELSE
    IF NEW.body IS DISTINCT FROM OLD.body
      AND auth.uid() IS NOT NULL
      AND OLD.author_id <> auth.uid() THEN
      RAISE EXCEPTION 'Only the author can edit a comment';
    END IF;
    IF NEW.resolved_at IS DISTINCT FROM OLD.resolved_at THEN
      NEW.resolved_by := CASE WHEN NEW.resolved_at IS NULL THEN NULL ELSE auth.uid() END;
    END IF;
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS project_canvas_comments_guard ON public.project_canvas_comments;
CREATE TRIGGER project_canvas_comments_guard
  BEFORE INSERT OR UPDATE ON public.project_canvas_comments
  FOR EACH ROW EXECUTE FUNCTION public.project_canvas_comments_guard();

ALTER TABLE public.project_canvas_comments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS project_canvas_comments_select ON public.project_canvas_comments;
CREATE POLICY project_canvas_comments_select ON public.project_canvas_comments
  FOR SELECT TO authenticated
  USING (public.can_view_project_canvas(project_id));

DROP POLICY IF EXISTS project_canvas_comments_insert ON public.project_canvas_comments;
CREATE POLICY project_canvas_comments_insert ON public.project_canvas_comments
  FOR INSERT TO authenticated
  WITH CHECK (
    author_id = (SELECT auth.uid())
    AND public.can_view_project_canvas(project_id)
  );

DROP POLICY IF EXISTS project_canvas_comments_update ON public.project_canvas_comments;
CREATE POLICY project_canvas_comments_update ON public.project_canvas_comments
  FOR UPDATE TO authenticated
  USING (
    public.can_view_project_canvas(project_id)
    AND (
      author_id = (SELECT auth.uid())
      OR public.can_edit_project_canvas(account_id)
    )
  )
  WITH CHECK (
    public.can_view_project_canvas(project_id)
    AND (
      author_id = (SELECT auth.uid())
      OR public.can_edit_project_canvas(account_id)
    )
  );

DROP POLICY IF EXISTS project_canvas_comments_delete ON public.project_canvas_comments;
CREATE POLICY project_canvas_comments_delete ON public.project_canvas_comments
  FOR DELETE TO authenticated
  USING (
    public.can_view_project_canvas(project_id)
    AND (
      author_id = (SELECT auth.uid())
      OR public.can_edit_project_canvas(account_id)
    )
  );

REVOKE ALL ON public.project_canvas_comments FROM anon;
REVOKE UPDATE ON public.project_canvas_comments FROM authenticated;
GRANT SELECT, INSERT, DELETE ON public.project_canvas_comments TO authenticated;
GRANT UPDATE (body, resolved_at) ON public.project_canvas_comments TO authenticated;
GRANT ALL ON public.project_canvas_comments TO service_role;

