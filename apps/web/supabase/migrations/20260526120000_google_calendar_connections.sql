-- Store per-user Google Calendar OAuth tokens for Keel Planner.

CREATE TABLE IF NOT EXISTS public.google_calendar_connections (
  user_id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  access_token_encrypted text NOT NULL,
  refresh_token_encrypted text,
  token_expires_at timestamptz,
  calendar_id text NOT NULL DEFAULT 'primary',
  planner_calendar_id text,
  scopes text,
  connected_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.google_calendar_connections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS google_calendar_connections_select ON public.google_calendar_connections;
CREATE POLICY google_calendar_connections_select
  ON public.google_calendar_connections
  FOR SELECT
  TO authenticated
  USING (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS google_calendar_connections_insert ON public.google_calendar_connections;
CREATE POLICY google_calendar_connections_insert
  ON public.google_calendar_connections
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS google_calendar_connections_update ON public.google_calendar_connections;
CREATE POLICY google_calendar_connections_update
  ON public.google_calendar_connections
  FOR UPDATE
  TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS google_calendar_connections_delete ON public.google_calendar_connections;
CREATE POLICY google_calendar_connections_delete
  ON public.google_calendar_connections
  FOR DELETE
  TO authenticated
  USING (user_id = (SELECT auth.uid()));

DROP TRIGGER IF EXISTS google_calendar_connections_set_updated_at
  ON public.google_calendar_connections;
CREATE TRIGGER google_calendar_connections_set_updated_at
  BEFORE UPDATE ON public.google_calendar_connections
  FOR EACH ROW
  EXECUTE PROCEDURE public.trigger_set_timestamps();

GRANT SELECT, INSERT, UPDATE, DELETE
  ON public.google_calendar_connections
  TO authenticated, service_role;
