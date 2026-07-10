-- Scheduling: Zoom / Teams linked accounts per workspace.
-- Google Meet uses google_calendar_connections (user-scoped), not this table.

CREATE TABLE IF NOT EXISTS public.conferencing_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.accounts (id) ON DELETE CASCADE,
  provider text NOT NULL,
  -- Tokens should move to Vault or be encrypted at rest before GA.
  access_token text NOT NULL,
  refresh_token text,
  expires_at timestamptz,
  provider_account_email text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT conferencing_connections_account_id_provider_key
    UNIQUE (account_id, provider),
  CONSTRAINT conferencing_connections_provider_check
    CHECK (provider = ANY (ARRAY['zoom'::text, 'teams'::text]))
);

COMMENT ON TABLE public.conferencing_connections IS
  'Per-workspace Zoom/Teams links. Google Meet rides on google_calendar_connections.';

COMMENT ON COLUMN public.conferencing_connections.access_token IS
  'Plaintext for now — move to Vault or encrypt at rest before GA.';

COMMENT ON COLUMN public.conferencing_connections.refresh_token IS
  'Plaintext for now — move to Vault or encrypt at rest before GA.';

COMMENT ON COLUMN public.conferencing_connections.provider IS
  'zoom | teams';

CREATE INDEX IF NOT EXISTS conferencing_connections_account_id_idx
  ON public.conferencing_connections (account_id);

DROP TRIGGER IF EXISTS conferencing_connections_set_timestamps
  ON public.conferencing_connections;
CREATE TRIGGER conferencing_connections_set_timestamps
  BEFORE INSERT OR UPDATE ON public.conferencing_connections
  FOR EACH ROW EXECUTE FUNCTION public.trigger_set_timestamps();

ALTER TABLE public.conferencing_connections ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.conferencing_connections TO authenticated, service_role;
