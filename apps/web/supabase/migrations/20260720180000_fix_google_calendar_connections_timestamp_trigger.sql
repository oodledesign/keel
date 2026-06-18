-- google_calendar_connections uses connected_at + updated_at (no created_at).
-- trigger_set_timestamps() references NEW.created_at and breaks token refresh / planner sync.

DROP TRIGGER IF EXISTS google_calendar_connections_set_updated_at
  ON public.google_calendar_connections;

CREATE OR REPLACE FUNCTION public.trigger_google_calendar_connections_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER google_calendar_connections_set_updated_at
  BEFORE UPDATE ON public.google_calendar_connections
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_google_calendar_connections_updated_at();

COMMENT ON FUNCTION public.trigger_google_calendar_connections_updated_at() IS
  'Sets updated_at on google_calendar_connections (table has connected_at, not created_at).';
