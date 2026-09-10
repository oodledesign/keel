-- Chrome extension Meet speaker stamps (cloud buffer when local Assistant is offline).

CREATE TABLE IF NOT EXISTS public.extension_speaker_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.accounts (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  session_id text NOT NULL,
  meet_url text,
  meet_code text,
  name text,
  started_at timestamptz NOT NULL,
  ended_at timestamptz,
  source text NOT NULL,
  confidence text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT extension_speaker_events_source_check
    CHECK (source IN ('active_speaker', 'tile', 'caption', 'unknown')),
  CONSTRAINT extension_speaker_events_confidence_check
    CHECK (confidence IN ('high', 'medium', 'low'))
);

CREATE INDEX IF NOT EXISTS ix_extension_speaker_events_session
  ON public.extension_speaker_events (user_id, session_id, started_at);

CREATE INDEX IF NOT EXISTS ix_extension_speaker_events_account
  ON public.extension_speaker_events (account_id, created_at DESC);

COMMENT ON TABLE public.extension_speaker_events IS
  'Timed Google Meet speaker observations from the Ozer Chrome extension. Live stamps belong on local Assistant; this table is the cloud buffer / pull path.';

ALTER TABLE public.extension_speaker_events ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.extension_speaker_events FROM authenticated, service_role;
GRANT SELECT, INSERT, DELETE
  ON public.extension_speaker_events
  TO authenticated, service_role;

DROP POLICY IF EXISTS extension_speaker_events_select ON public.extension_speaker_events;
CREATE POLICY extension_speaker_events_select
  ON public.extension_speaker_events
  FOR SELECT
  TO authenticated
  USING (
    user_id = (SELECT auth.uid())
    OR public.has_role_on_account(account_id)
  );

DROP POLICY IF EXISTS extension_speaker_events_insert ON public.extension_speaker_events;
CREATE POLICY extension_speaker_events_insert
  ON public.extension_speaker_events
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = (SELECT auth.uid())
    AND public.has_role_on_account(account_id)
  );

DROP POLICY IF EXISTS extension_speaker_events_delete ON public.extension_speaker_events;
CREATE POLICY extension_speaker_events_delete
  ON public.extension_speaker_events
  FOR DELETE
  TO authenticated
  USING (
    user_id = (SELECT auth.uid())
    OR public.has_role_on_account(account_id)
  );

NOTIFY pgrst, 'reload schema';
