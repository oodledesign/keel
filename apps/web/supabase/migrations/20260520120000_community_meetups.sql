-- Community / homegroup meetup scheduling, content, templates, records, and member notes.

CREATE TABLE IF NOT EXISTS public.community_meetup_series (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_community_meetup_series_account
  ON public.community_meetup_series(account_id);

ALTER TABLE public.account_calendar_events
  ADD COLUMN IF NOT EXISTS series_id uuid REFERENCES public.community_meetup_series(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS series_label text,
  ADD COLUMN IF NOT EXISTS template_id uuid,
  ADD COLUMN IF NOT EXISTS meal_plan text,
  ADD COLUMN IF NOT EXISTS evening_parts jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'scheduled'
    CHECK (status IN ('scheduled', 'completed', 'cancelled'));

COMMENT ON COLUMN public.account_calendar_events.evening_parts IS
  'JSON array of { id, title, notes } for segments of the meetup evening.';

CREATE TABLE IF NOT EXISTS public.community_meetup_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  name text NOT NULL,
  default_title text,
  meal_plan text,
  evening_parts jsonb NOT NULL DEFAULT '[]'::jsonb,
  content_items jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_community_meetup_templates_account
  ON public.community_meetup_templates(account_id);

ALTER TABLE public.account_calendar_events
  DROP CONSTRAINT IF EXISTS account_calendar_events_template_id_fkey;

ALTER TABLE public.account_calendar_events
  ADD CONSTRAINT account_calendar_events_template_id_fkey
  FOREIGN KEY (template_id) REFERENCES public.community_meetup_templates(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS public.community_meetup_content_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.account_calendar_events(id) ON DELETE CASCADE,
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('richtext', 'link', 'youtube', 'video')),
  title text NOT NULL DEFAULT '',
  body text,
  url text,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_community_meetup_content_event
  ON public.community_meetup_content_items(event_id, sort_order);

CREATE TABLE IF NOT EXISTS public.community_meetup_attendees (
  event_id uuid NOT NULL REFERENCES public.account_calendar_events(id) ON DELETE CASCADE,
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'going'
    CHECK (status IN ('going', 'maybe', 'not_going')),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (event_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.community_meetup_records (
  event_id uuid PRIMARY KEY REFERENCES public.account_calendar_events(id) ON DELETE CASCADE,
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  transcript text,
  ai_summary text,
  reflection_notes text,
  summarized_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.community_member_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  subject_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  author_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  visibility text NOT NULL DEFAULT 'leaders'
    CHECK (visibility IN ('leaders', 'leaders_and_subject', 'private')),
  category text NOT NULL DEFAULT 'general'
    CHECK (category IN ('general', 'prayer_request')),
  content text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_community_member_notes_account_subject
  ON public.community_member_notes(account_id, subject_user_id);

-- Timestamps
DROP TRIGGER IF EXISTS community_meetup_series_set_timestamps ON public.community_meetup_series;
CREATE TRIGGER community_meetup_series_set_timestamps
  BEFORE INSERT OR UPDATE ON public.community_meetup_series
  FOR EACH ROW EXECUTE FUNCTION public.trigger_set_timestamps();

DROP TRIGGER IF EXISTS community_meetup_templates_set_timestamps ON public.community_meetup_templates;
CREATE TRIGGER community_meetup_templates_set_timestamps
  BEFORE INSERT OR UPDATE ON public.community_meetup_templates
  FOR EACH ROW EXECUTE FUNCTION public.trigger_set_timestamps();

DROP TRIGGER IF EXISTS community_meetup_content_items_set_timestamps ON public.community_meetup_content_items;
CREATE TRIGGER community_meetup_content_items_set_timestamps
  BEFORE INSERT OR UPDATE ON public.community_meetup_content_items
  FOR EACH ROW EXECUTE FUNCTION public.trigger_set_timestamps();

DROP TRIGGER IF EXISTS community_meetup_records_set_timestamps ON public.community_meetup_records;
CREATE TRIGGER community_meetup_records_set_timestamps
  BEFORE INSERT OR UPDATE ON public.community_meetup_records
  FOR EACH ROW EXECUTE FUNCTION public.trigger_set_timestamps();

DROP TRIGGER IF EXISTS community_member_notes_set_timestamps ON public.community_member_notes;
CREATE TRIGGER community_member_notes_set_timestamps
  BEFORE INSERT OR UPDATE ON public.community_member_notes
  FOR EACH ROW EXECUTE FUNCTION public.trigger_set_timestamps();

-- RLS
ALTER TABLE public.community_meetup_series ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_meetup_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_meetup_content_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_meetup_attendees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_meetup_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_member_notes ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.community_meetup_series TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.community_meetup_templates TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.community_meetup_content_items TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.community_meetup_attendees TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.community_meetup_records TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.community_member_notes TO authenticated, service_role;

-- Series
DROP POLICY IF EXISTS community_meetup_series_select ON public.community_meetup_series;
CREATE POLICY community_meetup_series_select ON public.community_meetup_series FOR SELECT TO authenticated
  USING (public.has_role_on_account(account_id));
CREATE POLICY community_meetup_series_insert ON public.community_meetup_series FOR INSERT TO authenticated
  WITH CHECK (public.has_role_on_account(account_id));
CREATE POLICY community_meetup_series_update ON public.community_meetup_series FOR UPDATE TO authenticated
  USING (public.has_role_on_account(account_id)) WITH CHECK (public.has_role_on_account(account_id));
CREATE POLICY community_meetup_series_delete ON public.community_meetup_series FOR DELETE TO authenticated
  USING (public.has_role_on_account(account_id));

-- Templates
DROP POLICY IF EXISTS community_meetup_templates_select ON public.community_meetup_templates;
CREATE POLICY community_meetup_templates_select ON public.community_meetup_templates FOR SELECT TO authenticated
  USING (public.has_role_on_account(account_id));
DROP POLICY IF EXISTS community_meetup_templates_insert ON public.community_meetup_templates;
CREATE POLICY community_meetup_templates_insert ON public.community_meetup_templates FOR INSERT TO authenticated
  WITH CHECK (public.has_role_on_account(account_id));
DROP POLICY IF EXISTS community_meetup_templates_update ON public.community_meetup_templates;
CREATE POLICY community_meetup_templates_update ON public.community_meetup_templates FOR UPDATE TO authenticated
  USING (public.has_role_on_account(account_id)) WITH CHECK (public.has_role_on_account(account_id));
DROP POLICY IF EXISTS community_meetup_templates_delete ON public.community_meetup_templates;
CREATE POLICY community_meetup_templates_delete ON public.community_meetup_templates FOR DELETE TO authenticated
  USING (public.has_role_on_account(account_id));

-- Content items
DROP POLICY IF EXISTS community_meetup_content_select ON public.community_meetup_content_items;
CREATE POLICY community_meetup_content_select ON public.community_meetup_content_items FOR SELECT TO authenticated
  USING (public.has_role_on_account(account_id));
DROP POLICY IF EXISTS community_meetup_content_insert ON public.community_meetup_content_items;
CREATE POLICY community_meetup_content_insert ON public.community_meetup_content_items FOR INSERT TO authenticated
  WITH CHECK (public.has_role_on_account(account_id));
DROP POLICY IF EXISTS community_meetup_content_update ON public.community_meetup_content_items;
CREATE POLICY community_meetup_content_update ON public.community_meetup_content_items FOR UPDATE TO authenticated
  USING (public.has_role_on_account(account_id)) WITH CHECK (public.has_role_on_account(account_id));
DROP POLICY IF EXISTS community_meetup_content_delete ON public.community_meetup_content_items;
CREATE POLICY community_meetup_content_delete ON public.community_meetup_content_items FOR DELETE TO authenticated
  USING (public.has_role_on_account(account_id));

-- Attendees
DROP POLICY IF EXISTS community_meetup_attendees_select ON public.community_meetup_attendees;
CREATE POLICY community_meetup_attendees_select ON public.community_meetup_attendees FOR SELECT TO authenticated
  USING (public.has_role_on_account(account_id));
DROP POLICY IF EXISTS community_meetup_attendees_insert ON public.community_meetup_attendees;
CREATE POLICY community_meetup_attendees_insert ON public.community_meetup_attendees FOR INSERT TO authenticated
  WITH CHECK (public.has_role_on_account(account_id));
DROP POLICY IF EXISTS community_meetup_attendees_update ON public.community_meetup_attendees;
CREATE POLICY community_meetup_attendees_update ON public.community_meetup_attendees FOR UPDATE TO authenticated
  USING (public.has_role_on_account(account_id)) WITH CHECK (public.has_role_on_account(account_id));
DROP POLICY IF EXISTS community_meetup_attendees_delete ON public.community_meetup_attendees;
CREATE POLICY community_meetup_attendees_delete ON public.community_meetup_attendees FOR DELETE TO authenticated
  USING (public.has_role_on_account(account_id));

-- Records
DROP POLICY IF EXISTS community_meetup_records_select ON public.community_meetup_records;
CREATE POLICY community_meetup_records_select ON public.community_meetup_records FOR SELECT TO authenticated
  USING (public.has_role_on_account(account_id));
DROP POLICY IF EXISTS community_meetup_records_insert ON public.community_meetup_records;
CREATE POLICY community_meetup_records_insert ON public.community_meetup_records FOR INSERT TO authenticated
  WITH CHECK (public.has_role_on_account(account_id));
DROP POLICY IF EXISTS community_meetup_records_update ON public.community_meetup_records;
CREATE POLICY community_meetup_records_update ON public.community_meetup_records FOR UPDATE TO authenticated
  USING (public.has_role_on_account(account_id)) WITH CHECK (public.has_role_on_account(account_id));
DROP POLICY IF EXISTS community_meetup_records_delete ON public.community_meetup_records;
CREATE POLICY community_meetup_records_delete ON public.community_meetup_records FOR DELETE TO authenticated
  USING (public.has_role_on_account(account_id));

-- Member notes: leaders see all; members see own subject notes when visibility allows
CREATE OR REPLACE FUNCTION public.can_read_community_member_note(
  p_account_id uuid,
  p_subject_user_id uuid,
  p_author_user_id uuid,
  p_visibility text
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT
    public.has_role_on_account(p_account_id)
    AND (
      public.is_account_owner(p_account_id)
      OR EXISTS (
        SELECT 1 FROM public.accounts_memberships m
        WHERE m.account_id = p_account_id
          AND m.user_id = auth.uid()
          AND m.account_role IN ('owner', 'admin')
      )
      OR (p_visibility = 'leaders_and_subject' AND auth.uid() = p_subject_user_id)
      OR (p_visibility = 'private' AND auth.uid() = p_author_user_id)
    );
$$;

GRANT EXECUTE ON FUNCTION public.can_read_community_member_note(uuid, uuid, uuid, text) TO authenticated;

DROP POLICY IF EXISTS community_member_notes_select ON public.community_member_notes;
CREATE POLICY community_member_notes_select ON public.community_member_notes FOR SELECT TO authenticated
  USING (
    public.can_read_community_member_note(account_id, subject_user_id, author_user_id, visibility)
  );

DROP POLICY IF EXISTS community_member_notes_insert ON public.community_member_notes;
CREATE POLICY community_member_notes_insert ON public.community_member_notes FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role_on_account(account_id) AND author_user_id = auth.uid()
  );

DROP POLICY IF EXISTS community_member_notes_update ON public.community_member_notes;
CREATE POLICY community_member_notes_update ON public.community_member_notes FOR UPDATE TO authenticated
  USING (author_user_id = auth.uid() AND public.has_role_on_account(account_id))
  WITH CHECK (author_user_id = auth.uid() AND public.has_role_on_account(account_id));

DROP POLICY IF EXISTS community_member_notes_delete ON public.community_member_notes;
CREATE POLICY community_member_notes_delete ON public.community_member_notes FOR DELETE TO authenticated
  USING (author_user_id = auth.uid() AND public.has_role_on_account(account_id));

NOTIFY pgrst, 'reload schema';
