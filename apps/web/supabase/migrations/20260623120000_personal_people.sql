-- Personal People module: friends/family tracking with dates, gifts, catchups, notes.

CREATE TABLE IF NOT EXISTS public.personal_people (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  nickname text,
  relationship_label text,
  email text,
  phone text,
  avatar_url text,
  general_notes text,
  catchup_cadence_days integer CHECK (catchup_cadence_days IS NULL OR catchup_cadence_days > 0),
  last_catchup_on date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_personal_people_user_id ON public.personal_people(user_id);
CREATE INDEX IF NOT EXISTS ix_personal_people_account_id ON public.personal_people(account_id);
CREATE INDEX IF NOT EXISTS ix_personal_people_full_name ON public.personal_people(user_id, lower(full_name));

COMMENT ON TABLE public.personal_people IS
  'Personal-only contacts (friends, family) for the People module.';

CREATE TABLE IF NOT EXISTS public.personal_person_dates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id uuid NOT NULL REFERENCES public.personal_people(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('birthday', 'anniversary', 'custom')),
  month integer NOT NULL CHECK (month >= 1 AND month <= 12),
  day integer NOT NULL CHECK (day >= 1 AND day <= 31),
  year_optional integer CHECK (year_optional IS NULL OR year_optional >= 1900),
  label text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_personal_person_dates_person_id ON public.personal_person_dates(person_id);
CREATE INDEX IF NOT EXISTS ix_personal_person_dates_month_day ON public.personal_person_dates(month, day);

CREATE TABLE IF NOT EXISTS public.personal_person_gift_ideas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id uuid NOT NULL REFERENCES public.personal_people(id) ON DELETE CASCADE,
  title text NOT NULL,
  notes text,
  url text,
  occasion text,
  purchased boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_personal_person_gift_ideas_person_id
  ON public.personal_person_gift_ideas(person_id);

CREATE TABLE IF NOT EXISTS public.personal_person_catchups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id uuid NOT NULL REFERENCES public.personal_people(id) ON DELETE CASCADE,
  met_on date NOT NULL DEFAULT CURRENT_DATE,
  location text,
  conversation_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_personal_person_catchups_person_id
  ON public.personal_person_catchups(person_id);
CREATE INDEX IF NOT EXISTS ix_personal_person_catchups_met_on
  ON public.personal_person_catchups(person_id, met_on DESC);

CREATE TABLE IF NOT EXISTS public.personal_person_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id uuid NOT NULL REFERENCES public.personal_people(id) ON DELETE CASCADE,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_personal_person_notes_person_id
  ON public.personal_person_notes(person_id);

CREATE TABLE IF NOT EXISTS public.personal_people_reminder_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  person_id uuid NOT NULL REFERENCES public.personal_people(id) ON DELETE CASCADE,
  reminder_type text NOT NULL CHECK (
    reminder_type IN (
      'catchup_due',
      'birthday_7d',
      'birthday_today',
      'anniversary_7d',
      'anniversary_today'
    )
  ),
  reference_date date NOT NULL,
  sent_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (person_id, reminder_type, reference_date)
);

CREATE INDEX IF NOT EXISTS ix_personal_people_reminder_log_user_id
  ON public.personal_people_reminder_log(user_id);

-- Timestamps
DROP TRIGGER IF EXISTS personal_people_set_timestamps ON public.personal_people;
CREATE TRIGGER personal_people_set_timestamps
  BEFORE INSERT OR UPDATE ON public.personal_people
  FOR EACH ROW EXECUTE FUNCTION public.trigger_set_timestamps();

DROP TRIGGER IF EXISTS personal_person_dates_set_timestamps ON public.personal_person_dates;
CREATE TRIGGER personal_person_dates_set_timestamps
  BEFORE INSERT OR UPDATE ON public.personal_person_dates
  FOR EACH ROW EXECUTE FUNCTION public.trigger_set_timestamps();

DROP TRIGGER IF EXISTS personal_person_gift_ideas_set_timestamps ON public.personal_person_gift_ideas;
CREATE TRIGGER personal_person_gift_ideas_set_timestamps
  BEFORE INSERT OR UPDATE ON public.personal_person_gift_ideas
  FOR EACH ROW EXECUTE FUNCTION public.trigger_set_timestamps();

DROP TRIGGER IF EXISTS personal_person_catchups_set_timestamps ON public.personal_person_catchups;
CREATE TRIGGER personal_person_catchups_set_timestamps
  BEFORE INSERT OR UPDATE ON public.personal_person_catchups
  FOR EACH ROW EXECUTE FUNCTION public.trigger_set_timestamps();

DROP TRIGGER IF EXISTS personal_person_notes_set_timestamps ON public.personal_person_notes;
CREATE TRIGGER personal_person_notes_set_timestamps
  BEFORE INSERT OR UPDATE ON public.personal_person_notes
  FOR EACH ROW EXECUTE FUNCTION public.trigger_set_timestamps();

-- RLS helper: person owned by current user
CREATE OR REPLACE FUNCTION public.personal_person_owned_by_user(p_person_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.personal_people p
    WHERE p.id = p_person_id
      AND p.user_id = auth.uid()
  );
$$;

GRANT EXECUTE ON FUNCTION public.personal_person_owned_by_user(uuid) TO authenticated;

ALTER TABLE public.personal_people ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.personal_person_dates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.personal_person_gift_ideas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.personal_person_catchups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.personal_person_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.personal_people_reminder_log ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.personal_people TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.personal_person_dates TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.personal_person_gift_ideas TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.personal_person_catchups TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.personal_person_notes TO authenticated, service_role;
GRANT SELECT, INSERT ON public.personal_people_reminder_log TO authenticated, service_role;

-- personal_people policies
DROP POLICY IF EXISTS personal_people_select ON public.personal_people;
CREATE POLICY personal_people_select ON public.personal_people
  FOR SELECT TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS personal_people_insert ON public.personal_people;
CREATE POLICY personal_people_insert ON public.personal_people
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.accounts a
      WHERE a.id = account_id
        AND a.is_personal_account = true
        AND a.primary_owner_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS personal_people_update ON public.personal_people;
CREATE POLICY personal_people_update ON public.personal_people
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS personal_people_delete ON public.personal_people;
CREATE POLICY personal_people_delete ON public.personal_people
  FOR DELETE TO authenticated USING (user_id = auth.uid());

-- Child table policies (via person ownership)
DROP POLICY IF EXISTS personal_person_dates_select ON public.personal_person_dates;
CREATE POLICY personal_person_dates_select ON public.personal_person_dates
  FOR SELECT TO authenticated
  USING (public.personal_person_owned_by_user(person_id));

DROP POLICY IF EXISTS personal_person_dates_insert ON public.personal_person_dates;
CREATE POLICY personal_person_dates_insert ON public.personal_person_dates
  FOR INSERT TO authenticated
  WITH CHECK (public.personal_person_owned_by_user(person_id));

DROP POLICY IF EXISTS personal_person_dates_update ON public.personal_person_dates;
CREATE POLICY personal_person_dates_update ON public.personal_person_dates
  FOR UPDATE TO authenticated
  USING (public.personal_person_owned_by_user(person_id))
  WITH CHECK (public.personal_person_owned_by_user(person_id));

DROP POLICY IF EXISTS personal_person_dates_delete ON public.personal_person_dates;
CREATE POLICY personal_person_dates_delete ON public.personal_person_dates
  FOR DELETE TO authenticated
  USING (public.personal_person_owned_by_user(person_id));

DROP POLICY IF EXISTS personal_person_gift_ideas_select ON public.personal_person_gift_ideas;
CREATE POLICY personal_person_gift_ideas_select ON public.personal_person_gift_ideas
  FOR SELECT TO authenticated
  USING (public.personal_person_owned_by_user(person_id));

DROP POLICY IF EXISTS personal_person_gift_ideas_insert ON public.personal_person_gift_ideas;
CREATE POLICY personal_person_gift_ideas_insert ON public.personal_person_gift_ideas
  FOR INSERT TO authenticated
  WITH CHECK (public.personal_person_owned_by_user(person_id));

DROP POLICY IF EXISTS personal_person_gift_ideas_update ON public.personal_person_gift_ideas;
CREATE POLICY personal_person_gift_ideas_update ON public.personal_person_gift_ideas
  FOR UPDATE TO authenticated
  USING (public.personal_person_owned_by_user(person_id))
  WITH CHECK (public.personal_person_owned_by_user(person_id));

DROP POLICY IF EXISTS personal_person_gift_ideas_delete ON public.personal_person_gift_ideas;
CREATE POLICY personal_person_gift_ideas_delete ON public.personal_person_gift_ideas
  FOR DELETE TO authenticated
  USING (public.personal_person_owned_by_user(person_id));

DROP POLICY IF EXISTS personal_person_catchups_select ON public.personal_person_catchups;
CREATE POLICY personal_person_catchups_select ON public.personal_person_catchups
  FOR SELECT TO authenticated
  USING (public.personal_person_owned_by_user(person_id));

DROP POLICY IF EXISTS personal_person_catchups_insert ON public.personal_person_catchups;
CREATE POLICY personal_person_catchups_insert ON public.personal_person_catchups
  FOR INSERT TO authenticated
  WITH CHECK (public.personal_person_owned_by_user(person_id));

DROP POLICY IF EXISTS personal_person_catchups_update ON public.personal_person_catchups;
CREATE POLICY personal_person_catchups_update ON public.personal_person_catchups
  FOR UPDATE TO authenticated
  USING (public.personal_person_owned_by_user(person_id))
  WITH CHECK (public.personal_person_owned_by_user(person_id));

DROP POLICY IF EXISTS personal_person_catchups_delete ON public.personal_person_catchups;
CREATE POLICY personal_person_catchups_delete ON public.personal_person_catchups
  FOR DELETE TO authenticated
  USING (public.personal_person_owned_by_user(person_id));

DROP POLICY IF EXISTS personal_person_notes_select ON public.personal_person_notes;
CREATE POLICY personal_person_notes_select ON public.personal_person_notes
  FOR SELECT TO authenticated
  USING (public.personal_person_owned_by_user(person_id));

DROP POLICY IF EXISTS personal_person_notes_insert ON public.personal_person_notes;
CREATE POLICY personal_person_notes_insert ON public.personal_person_notes
  FOR INSERT TO authenticated
  WITH CHECK (public.personal_person_owned_by_user(person_id));

DROP POLICY IF EXISTS personal_person_notes_update ON public.personal_person_notes;
CREATE POLICY personal_person_notes_update ON public.personal_person_notes
  FOR UPDATE TO authenticated
  USING (public.personal_person_owned_by_user(person_id))
  WITH CHECK (public.personal_person_owned_by_user(person_id));

DROP POLICY IF EXISTS personal_person_notes_delete ON public.personal_person_notes;
CREATE POLICY personal_person_notes_delete ON public.personal_person_notes
  FOR DELETE TO authenticated
  USING (public.personal_person_owned_by_user(person_id));

DROP POLICY IF EXISTS personal_people_reminder_log_select ON public.personal_people_reminder_log;
CREATE POLICY personal_people_reminder_log_select ON public.personal_people_reminder_log
  FOR SELECT TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS personal_people_reminder_log_service ON public.personal_people_reminder_log;
CREATE POLICY personal_people_reminder_log_service ON public.personal_people_reminder_log
  FOR ALL TO service_role USING (true) WITH CHECK (true);

NOTIFY pgrst, 'reload schema';
