-- Meeting polls (Doodle-style group scheduling inside the scheduler).
--
-- APPLY THIS MIGRATION MANUALLY IN PRODUCTION.
-- Dan applies prod migrations by hand; do not assume a deploy runs it.
--
-- Public invitee pages must not use anonymous RLS. Invitees reach a poll
-- only through a server route that looks up meeting_poll_invitees.token
-- with the service role and returns that poll alone.

CREATE TABLE IF NOT EXISTS public.meeting_polls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.accounts (id) ON DELETE CASCADE,
  host_user_id uuid NOT NULL REFERENCES auth.users (id),
  title text NOT NULL,
  description text,
  location text,
  duration_minutes integer NOT NULL,
  range_start date NOT NULL,
  range_end date NOT NULL,
  timezone text NOT NULL DEFAULT 'Europe/London',
  show_voter_names boolean NOT NULL DEFAULT true,
  status text NOT NULL DEFAULT 'draft',
  client_id uuid REFERENCES public.clients (id) ON DELETE SET NULL,
  project_id uuid REFERENCES public.projects (id) ON DELETE SET NULL,
  chosen_slot_id uuid,
  confirmed_at timestamptz,
  calendar_provider text,
  calendar_event_id text,
  conferencing_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT meeting_polls_title_check CHECK (char_length(title) BETWEEN 1 AND 160),
  CONSTRAINT meeting_polls_duration_check
    CHECK (duration_minutes >= 5 AND duration_minutes <= 480),
  CONSTRAINT meeting_polls_range_check CHECK (range_end >= range_start),
  CONSTRAINT meeting_polls_status_check
    CHECK (status = ANY (ARRAY['draft'::text, 'open'::text, 'closed'::text, 'cancelled'::text])),
  CONSTRAINT meeting_polls_calendar_provider_check
    CHECK (
      calendar_provider IS NULL
      OR calendar_provider = ANY (ARRAY['google'::text, 'ozer'::text])
    )
);

COMMENT ON TABLE public.meeting_polls IS
  'Group meeting polls. status: draft (not emailed) | open | closed | cancelled. Public access is service-role via invitee token only.';

COMMENT ON COLUMN public.meeting_polls.show_voter_names IS
  'When false, invitees see counts only. The organiser always sees names.';

COMMENT ON COLUMN public.meeting_polls.timezone IS
  'Organiser IANA timezone used for suggestions and the in-app grid. Voters see their own local time on the public page.';

COMMENT ON COLUMN public.meeting_polls.calendar_provider IS
  'google when the final event was written to Google Calendar; ozer when it was stored as an account calendar event.';

CREATE INDEX IF NOT EXISTS meeting_polls_account_id_idx
  ON public.meeting_polls (account_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS meeting_polls_client_id_idx
  ON public.meeting_polls (client_id)
  WHERE client_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS meeting_polls_project_id_idx
  ON public.meeting_polls (project_id)
  WHERE project_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.meeting_poll_slots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  poll_id uuid NOT NULL REFERENCES public.meeting_polls (id) ON DELETE CASCADE,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  source text NOT NULL DEFAULT 'manual',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT meeting_poll_slots_range_check CHECK (ends_at > starts_at),
  CONSTRAINT meeting_poll_slots_source_check
    CHECK (source = ANY (ARRAY['suggested'::text, 'manual'::text])),
  CONSTRAINT meeting_poll_slots_poll_id_starts_at_key UNIQUE (poll_id, starts_at)
);

COMMENT ON TABLE public.meeting_poll_slots IS
  'Candidate times on a meeting poll. Suggested from the organiser calendar, or added by hand.';

CREATE INDEX IF NOT EXISTS meeting_poll_slots_poll_id_idx
  ON public.meeting_poll_slots (poll_id, starts_at);

ALTER TABLE public.meeting_polls
  DROP CONSTRAINT IF EXISTS meeting_polls_chosen_slot_id_fkey;

ALTER TABLE public.meeting_polls
  ADD CONSTRAINT meeting_polls_chosen_slot_id_fkey
  FOREIGN KEY (chosen_slot_id)
  REFERENCES public.meeting_poll_slots (id)
  ON DELETE SET NULL
  DEFERRABLE INITIALLY DEFERRED;

CREATE TABLE IF NOT EXISTS public.meeting_poll_invitees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  poll_id uuid NOT NULL REFERENCES public.meeting_polls (id) ON DELETE CASCADE,
  email text NOT NULL,
  name text,
  contact_id uuid REFERENCES public.contacts (id) ON DELETE SET NULL,
  token text NOT NULL,
  invited_at timestamptz,
  responded_at timestamptz,
  last_reminded_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT meeting_poll_invitees_poll_email_key UNIQUE (poll_id, email),
  CONSTRAINT meeting_poll_invitees_token_key UNIQUE (token),
  CONSTRAINT meeting_poll_invitees_token_check CHECK (token ~ '^[a-f0-9]{64}$'),
  CONSTRAINT meeting_poll_invitees_email_check CHECK (position('@' IN email) > 1)
);

COMMENT ON TABLE public.meeting_poll_invitees IS
  'One row per voter. token is the unguessable public link secret. Never expose other rows via anonymous policies.';

COMMENT ON COLUMN public.meeting_poll_invitees.token IS
  '64-char hex secret for /poll/{token}. Resolved only by service-role server routes.';

CREATE INDEX IF NOT EXISTS meeting_poll_invitees_poll_id_idx
  ON public.meeting_poll_invitees (poll_id);

CREATE TABLE IF NOT EXISTS public.meeting_poll_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invitee_id uuid NOT NULL REFERENCES public.meeting_poll_invitees (id) ON DELETE CASCADE,
  slot_id uuid NOT NULL REFERENCES public.meeting_poll_slots (id) ON DELETE CASCADE,
  answer text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT meeting_poll_responses_invitee_slot_key UNIQUE (invitee_id, slot_id),
  CONSTRAINT meeting_poll_responses_answer_check
    CHECK (answer = ANY (ARRAY['yes'::text, 'if_need_be'::text, 'no'::text]))
);

COMMENT ON TABLE public.meeting_poll_responses IS
  'yes | if_need_be | no for one invitee and one slot.';

CREATE INDEX IF NOT EXISTS meeting_poll_responses_slot_id_idx
  ON public.meeting_poll_responses (slot_id);

CREATE INDEX IF NOT EXISTS meeting_poll_responses_invitee_id_idx
  ON public.meeting_poll_responses (invitee_id);

DROP TRIGGER IF EXISTS meeting_polls_set_timestamps ON public.meeting_polls;
CREATE TRIGGER meeting_polls_set_timestamps
  BEFORE INSERT OR UPDATE ON public.meeting_polls
  FOR EACH ROW EXECUTE FUNCTION public.trigger_set_timestamps();

DROP TRIGGER IF EXISTS meeting_poll_slots_set_timestamps ON public.meeting_poll_slots;
CREATE TRIGGER meeting_poll_slots_set_timestamps
  BEFORE INSERT OR UPDATE ON public.meeting_poll_slots
  FOR EACH ROW EXECUTE FUNCTION public.trigger_set_timestamps();

DROP TRIGGER IF EXISTS meeting_poll_invitees_set_timestamps ON public.meeting_poll_invitees;
CREATE TRIGGER meeting_poll_invitees_set_timestamps
  BEFORE INSERT OR UPDATE ON public.meeting_poll_invitees
  FOR EACH ROW EXECUTE FUNCTION public.trigger_set_timestamps();

DROP TRIGGER IF EXISTS meeting_poll_responses_set_timestamps ON public.meeting_poll_responses;
CREATE TRIGGER meeting_poll_responses_set_timestamps
  BEFORE INSERT OR UPDATE ON public.meeting_poll_responses
  FOR EACH ROW EXECUTE FUNCTION public.trigger_set_timestamps();

-- host_user_id and account_id stay with the organiser who created the poll.
CREATE OR REPLACE FUNCTION public.meeting_poll_lock_immutable_columns()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.host_user_id IS DISTINCT FROM OLD.host_user_id
     OR NEW.account_id IS DISTINCT FROM OLD.account_id THEN
    RAISE EXCEPTION 'host_user_id and account_id are immutable';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.meeting_poll_lock_immutable_columns() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.meeting_poll_lock_immutable_columns() TO authenticated, service_role;

DROP TRIGGER IF EXISTS meeting_poll_lock_immutable_columns ON public.meeting_polls;
CREATE TRIGGER meeting_poll_lock_immutable_columns
  BEFORE UPDATE ON public.meeting_polls
  FOR EACH ROW
  EXECUTE FUNCTION public.meeting_poll_lock_immutable_columns();

-- First saved answer marks the invitee as responded even if the later name
-- write fails. Not SECURITY DEFINER. Votes are written by service role only.
CREATE OR REPLACE FUNCTION public.meeting_poll_touch_responded_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE public.meeting_poll_invitees
  SET responded_at = COALESCE(responded_at, now())
  WHERE id = NEW.invitee_id;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.meeting_poll_touch_responded_at() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.meeting_poll_touch_responded_at() TO service_role;

DROP TRIGGER IF EXISTS meeting_poll_touch_responded_at ON public.meeting_poll_responses;
CREATE TRIGGER meeting_poll_touch_responded_at
  AFTER INSERT OR UPDATE ON public.meeting_poll_responses
  FOR EACH ROW
  EXECUTE FUNCTION public.meeting_poll_touch_responded_at();

ALTER TABLE public.meeting_polls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meeting_poll_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meeting_poll_invitees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meeting_poll_responses ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.meeting_polls FROM PUBLIC, anon;
REVOKE ALL ON TABLE public.meeting_poll_slots FROM PUBLIC, anon;
REVOKE ALL ON TABLE public.meeting_poll_invitees FROM PUBLIC, anon;
REVOKE ALL ON TABLE public.meeting_poll_responses FROM PUBLIC, anon;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.meeting_polls TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.meeting_poll_slots TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.meeting_poll_invitees TO authenticated, service_role;
GRANT SELECT, DELETE ON TABLE public.meeting_poll_responses TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.meeting_poll_responses TO service_role;

DROP POLICY IF EXISTS meeting_polls_select ON public.meeting_polls;
CREATE POLICY meeting_polls_select ON public.meeting_polls
  FOR SELECT TO authenticated
  USING (
    public.has_permission(auth.uid(), account_id, 'scheduling.view'::public.app_permissions)
    OR public.has_permission(auth.uid(), account_id, 'scheduling.edit'::public.app_permissions)
  );

DROP POLICY IF EXISTS meeting_polls_insert ON public.meeting_polls;
CREATE POLICY meeting_polls_insert ON public.meeting_polls
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_permission(auth.uid(), account_id, 'scheduling.edit'::public.app_permissions)
  );

DROP POLICY IF EXISTS meeting_polls_update ON public.meeting_polls;
CREATE POLICY meeting_polls_update ON public.meeting_polls
  FOR UPDATE TO authenticated
  USING (
    public.has_permission(auth.uid(), account_id, 'scheduling.edit'::public.app_permissions)
  )
  WITH CHECK (
    public.has_permission(auth.uid(), account_id, 'scheduling.edit'::public.app_permissions)
  );

DROP POLICY IF EXISTS meeting_polls_delete ON public.meeting_polls;
CREATE POLICY meeting_polls_delete ON public.meeting_polls
  FOR DELETE TO authenticated
  USING (
    public.has_permission(auth.uid(), account_id, 'scheduling.edit'::public.app_permissions)
  );

DROP POLICY IF EXISTS meeting_poll_slots_select ON public.meeting_poll_slots;
CREATE POLICY meeting_poll_slots_select ON public.meeting_poll_slots
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.meeting_polls p
      WHERE p.id = meeting_poll_slots.poll_id
        AND (
          public.has_permission(auth.uid(), p.account_id, 'scheduling.view'::public.app_permissions)
          OR public.has_permission(auth.uid(), p.account_id, 'scheduling.edit'::public.app_permissions)
        )
    )
  );

DROP POLICY IF EXISTS meeting_poll_slots_insert ON public.meeting_poll_slots;
CREATE POLICY meeting_poll_slots_insert ON public.meeting_poll_slots
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.meeting_polls p
      WHERE p.id = meeting_poll_slots.poll_id
        AND public.has_permission(auth.uid(), p.account_id, 'scheduling.edit'::public.app_permissions)
    )
  );

DROP POLICY IF EXISTS meeting_poll_slots_update ON public.meeting_poll_slots;
CREATE POLICY meeting_poll_slots_update ON public.meeting_poll_slots
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.meeting_polls p
      WHERE p.id = meeting_poll_slots.poll_id
        AND public.has_permission(auth.uid(), p.account_id, 'scheduling.edit'::public.app_permissions)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.meeting_polls p
      WHERE p.id = meeting_poll_slots.poll_id
        AND public.has_permission(auth.uid(), p.account_id, 'scheduling.edit'::public.app_permissions)
    )
  );

DROP POLICY IF EXISTS meeting_poll_slots_delete ON public.meeting_poll_slots;
CREATE POLICY meeting_poll_slots_delete ON public.meeting_poll_slots
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.meeting_polls p
      WHERE p.id = meeting_poll_slots.poll_id
        AND public.has_permission(auth.uid(), p.account_id, 'scheduling.edit'::public.app_permissions)
    )
  );

DROP POLICY IF EXISTS meeting_poll_invitees_select ON public.meeting_poll_invitees;
CREATE POLICY meeting_poll_invitees_select ON public.meeting_poll_invitees
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.meeting_polls p
      WHERE p.id = meeting_poll_invitees.poll_id
        AND (
          public.has_permission(auth.uid(), p.account_id, 'scheduling.view'::public.app_permissions)
          OR public.has_permission(auth.uid(), p.account_id, 'scheduling.edit'::public.app_permissions)
        )
    )
  );

DROP POLICY IF EXISTS meeting_poll_invitees_insert ON public.meeting_poll_invitees;
CREATE POLICY meeting_poll_invitees_insert ON public.meeting_poll_invitees
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.meeting_polls p
      WHERE p.id = meeting_poll_invitees.poll_id
        AND public.has_permission(auth.uid(), p.account_id, 'scheduling.edit'::public.app_permissions)
    )
  );

DROP POLICY IF EXISTS meeting_poll_invitees_update ON public.meeting_poll_invitees;
CREATE POLICY meeting_poll_invitees_update ON public.meeting_poll_invitees
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.meeting_polls p
      WHERE p.id = meeting_poll_invitees.poll_id
        AND public.has_permission(auth.uid(), p.account_id, 'scheduling.edit'::public.app_permissions)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.meeting_polls p
      WHERE p.id = meeting_poll_invitees.poll_id
        AND public.has_permission(auth.uid(), p.account_id, 'scheduling.edit'::public.app_permissions)
    )
  );

DROP POLICY IF EXISTS meeting_poll_invitees_delete ON public.meeting_poll_invitees;
CREATE POLICY meeting_poll_invitees_delete ON public.meeting_poll_invitees
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.meeting_polls p
      WHERE p.id = meeting_poll_invitees.poll_id
        AND public.has_permission(auth.uid(), p.account_id, 'scheduling.edit'::public.app_permissions)
    )
  );

DROP POLICY IF EXISTS meeting_poll_responses_select ON public.meeting_poll_responses;
CREATE POLICY meeting_poll_responses_select ON public.meeting_poll_responses
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.meeting_poll_invitees i
      JOIN public.meeting_polls p ON p.id = i.poll_id
      WHERE i.id = meeting_poll_responses.invitee_id
        AND (
          public.has_permission(auth.uid(), p.account_id, 'scheduling.view'::public.app_permissions)
          OR public.has_permission(auth.uid(), p.account_id, 'scheduling.edit'::public.app_permissions)
        )
    )
  );

-- Votes are written only by the public token route (service role).
-- Authenticated organisers can read and, when a draft is replaced, delete.
DROP POLICY IF EXISTS meeting_poll_responses_insert ON public.meeting_poll_responses;
DROP POLICY IF EXISTS meeting_poll_responses_update ON public.meeting_poll_responses;

DROP POLICY IF EXISTS meeting_poll_responses_delete ON public.meeting_poll_responses;
CREATE POLICY meeting_poll_responses_delete ON public.meeting_poll_responses
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.meeting_poll_invitees i
      JOIN public.meeting_polls p ON p.id = i.poll_id
      WHERE i.id = meeting_poll_responses.invitee_id
        AND public.has_permission(auth.uid(), p.account_id, 'scheduling.edit'::public.app_permissions)
    )
  );
