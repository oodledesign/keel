-- Content calendar for projects: posts (with platforms and a scheduled /
-- posted status) and free-text notes for a week or a month. The roadmap view
-- reads these alongside phases and tasks.
--
-- Also adds the `roadmap` canvas kind, so an editable roadmap or calendar can
-- sit on the canvas next to everything else.

-- ---------------------------------------------------------------------------
-- Posts
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.project_content_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.accounts (id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES public.projects (id) ON DELETE CASCADE,
  post_date date NOT NULL,
  post_time time,
  title text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 300),
  body text NOT NULL DEFAULT '' CHECK (char_length(body) <= 20000),
  status text NOT NULL DEFAULT 'idea'
    CHECK (status IN ('idea', 'draft', 'scheduled', 'posted')),
  platforms text[] NOT NULL DEFAULT '{}'
    CHECK (
      cardinality(platforms) <= 12
      AND platforms <@ ARRAY[
        'instagram', 'facebook', 'linkedin', 'x', 'tiktok', 'youtube',
        'threads', 'pinterest', 'email', 'blog', 'other'
      ]::text[]
    ),
  link_url text CHECK (link_url IS NULL OR char_length(link_url) <= 2000),
  posted_at timestamptz,
  created_by uuid DEFAULT auth.uid() REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_project_content_posts_project_date
  ON public.project_content_posts (project_id, post_date);
CREATE INDEX IF NOT EXISTS ix_project_content_posts_account
  ON public.project_content_posts (account_id);

-- ---------------------------------------------------------------------------
-- Week / month notes
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.project_period_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.accounts (id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES public.projects (id) ON DELETE CASCADE,
  period_kind text NOT NULL CHECK (period_kind IN ('week', 'month')),
  -- Monday for a week, the 1st for a month.
  period_start date NOT NULL,
  body text NOT NULL DEFAULT '' CHECK (char_length(body) <= 5000),
  updated_by uuid DEFAULT auth.uid() REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, period_kind, period_start)
);

CREATE INDEX IF NOT EXISTS ix_project_period_notes_account
  ON public.project_period_notes (account_id);

-- ---------------------------------------------------------------------------
-- Guards: the project must belong to the account; stamp edit times.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.project_content_guard()
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
  ELSIF NEW.account_id <> OLD.account_id OR NEW.project_id <> OLD.project_id THEN
    RAISE EXCEPTION 'A project item cannot move to another project';
  END IF;

  NEW.updated_at := now();

  IF TG_TABLE_NAME = 'project_content_posts' THEN
    IF NEW.status = 'posted' AND NEW.posted_at IS NULL THEN
      NEW.posted_at := now();
    ELSIF NEW.status <> 'posted' THEN
      NEW.posted_at := NULL;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS project_content_posts_guard ON public.project_content_posts;
CREATE TRIGGER project_content_posts_guard
  BEFORE INSERT OR UPDATE ON public.project_content_posts
  FOR EACH ROW EXECUTE FUNCTION public.project_content_guard();

DROP TRIGGER IF EXISTS project_period_notes_guard ON public.project_period_notes;
CREATE TRIGGER project_period_notes_guard
  BEFORE INSERT OR UPDATE ON public.project_period_notes
  FOR EACH ROW EXECUTE FUNCTION public.project_content_guard();

-- ---------------------------------------------------------------------------
-- Row level security: same people who see / edit the project canvas.
-- ---------------------------------------------------------------------------

ALTER TABLE public.project_content_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_period_notes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS project_content_posts_select ON public.project_content_posts;
CREATE POLICY project_content_posts_select ON public.project_content_posts
  FOR SELECT TO authenticated
  USING (public.can_view_project_canvas(project_id));

DROP POLICY IF EXISTS project_content_posts_write ON public.project_content_posts;
CREATE POLICY project_content_posts_write ON public.project_content_posts
  FOR ALL TO authenticated
  USING (
    public.can_edit_project_canvas(account_id)
    OR public.can_guest_edit_project_canvas(account_id, project_id)
  )
  WITH CHECK (
    public.can_edit_project_canvas(account_id)
    OR public.can_guest_edit_project_canvas(account_id, project_id)
  );

DROP POLICY IF EXISTS project_period_notes_select ON public.project_period_notes;
CREATE POLICY project_period_notes_select ON public.project_period_notes
  FOR SELECT TO authenticated
  USING (public.can_view_project_canvas(project_id));

DROP POLICY IF EXISTS project_period_notes_write ON public.project_period_notes;
CREATE POLICY project_period_notes_write ON public.project_period_notes
  FOR ALL TO authenticated
  USING (
    public.can_edit_project_canvas(account_id)
    OR public.can_guest_edit_project_canvas(account_id, project_id)
  )
  WITH CHECK (
    public.can_edit_project_canvas(account_id)
    OR public.can_guest_edit_project_canvas(account_id, project_id)
  );

REVOKE ALL ON public.project_content_posts FROM anon;
REVOKE ALL ON public.project_period_notes FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_content_posts TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_period_notes TO authenticated;
GRANT ALL ON public.project_content_posts TO service_role;
GRANT ALL ON public.project_period_notes TO service_role;

-- ---------------------------------------------------------------------------
-- Canvas kind
-- ---------------------------------------------------------------------------

ALTER TABLE public.project_canvas_items
  DROP CONSTRAINT IF EXISTS project_canvas_items_kind_check;
ALTER TABLE public.project_canvas_items
  ADD CONSTRAINT project_canvas_items_kind_check CHECK (
    kind IN (
      'phase', 'task', 'member', 'client', 'note', 'contact', 'doc',
      'sticky', 'text', 'shape', 'frame', 'image', 'link', 'draw',
      'timeline', 'metric', 'roadmap', 'connector'
    )
  );

NOTIFY pgrst, 'reload schema';
