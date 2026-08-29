-- Contact-centric match digest: workspace auto-send, per-contact pause/token,
-- digest send metadata, and a more obvious default for new listings.

-- ---------------------------------------------------------------------------
-- Workspace-level auto-send (default on)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.commercial_circulation_settings (
  account_id uuid PRIMARY KEY REFERENCES public.accounts (id) ON DELETE CASCADE,
  auto_send_enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.commercial_circulation_settings IS
  'Per-workspace circulation controls. Missing row means auto-send is on.';

ALTER TABLE public.commercial_circulation_settings ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.commercial_circulation_settings FROM authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.commercial_circulation_settings TO authenticated;
GRANT ALL ON public.commercial_circulation_settings TO service_role;

DROP POLICY IF EXISTS commercial_circulation_settings_select
  ON public.commercial_circulation_settings;
CREATE POLICY commercial_circulation_settings_select
  ON public.commercial_circulation_settings
  FOR SELECT TO authenticated
  USING (public.has_role_on_account(account_id));

DROP POLICY IF EXISTS commercial_circulation_settings_insert
  ON public.commercial_circulation_settings;
CREATE POLICY commercial_circulation_settings_insert
  ON public.commercial_circulation_settings
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role_on_account(account_id));

DROP POLICY IF EXISTS commercial_circulation_settings_update
  ON public.commercial_circulation_settings;
CREATE POLICY commercial_circulation_settings_update
  ON public.commercial_circulation_settings
  FOR UPDATE TO authenticated
  USING (public.has_role_on_account(account_id))
  WITH CHECK (public.has_role_on_account(account_id));

DROP POLICY IF EXISTS commercial_circulation_settings_delete
  ON public.commercial_circulation_settings;
CREATE POLICY commercial_circulation_settings_delete
  ON public.commercial_circulation_settings
  FOR DELETE TO authenticated
  USING (public.has_role_on_account(account_id));

CREATE OR REPLACE FUNCTION public.set_commercial_circulation_settings_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS commercial_circulation_settings_set_updated_at
  ON public.commercial_circulation_settings;
CREATE TRIGGER commercial_circulation_settings_set_updated_at
  BEFORE UPDATE ON public.commercial_circulation_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.set_commercial_circulation_settings_updated_at();

-- ---------------------------------------------------------------------------
-- Per-contact pause, public page token, last digest fingerprint
-- ---------------------------------------------------------------------------
ALTER TABLE public.commercial_marketing_preferences
  ADD COLUMN IF NOT EXISTS auto_send_enabled boolean NOT NULL DEFAULT true;

ALTER TABLE public.commercial_marketing_preferences
  ADD COLUMN IF NOT EXISTS public_access_token text;

ALTER TABLE public.commercial_marketing_preferences
  ADD COLUMN IF NOT EXISTS last_digest_fingerprint text;

ALTER TABLE public.commercial_marketing_preferences
  ADD COLUMN IF NOT EXISTS last_digest_sent_at timestamptz;

UPDATE public.commercial_marketing_preferences
SET public_access_token = encode(gen_random_bytes(24), 'hex')
WHERE public_access_token IS NULL;

ALTER TABLE public.commercial_marketing_preferences
  ALTER COLUMN public_access_token SET DEFAULT encode(gen_random_bytes(24), 'hex');

CREATE UNIQUE INDEX IF NOT EXISTS commercial_marketing_preferences_public_token_uidx
  ON public.commercial_marketing_preferences (public_access_token)
  WHERE public_access_token IS NOT NULL;

COMMENT ON COLUMN public.commercial_marketing_preferences.auto_send_enabled IS
  'When false, skip this address on automatic match digests (pause).';

COMMENT ON COLUMN public.commercial_marketing_preferences.public_access_token IS
  'Stable secret for the public matches + preferences page.';

COMMENT ON COLUMN public.commercial_marketing_preferences.last_digest_fingerprint IS
  'Sorted listing ids from the last digest, used to skip identical re-sends.';

-- ---------------------------------------------------------------------------
-- Digest send rows may cover several listings
-- ---------------------------------------------------------------------------
ALTER TABLE public.commercial_circulation_sends
  ALTER COLUMN listing_id DROP NOT NULL;

ALTER TABLE public.commercial_circulation_sends
  ADD COLUMN IF NOT EXISTS send_kind text NOT NULL DEFAULT 'listing';

ALTER TABLE public.commercial_circulation_sends
  DROP CONSTRAINT IF EXISTS commercial_circulation_sends_send_kind_check;

ALTER TABLE public.commercial_circulation_sends
  ADD CONSTRAINT commercial_circulation_sends_send_kind_check
  CHECK (send_kind IN ('listing', 'digest'));

ALTER TABLE public.commercial_circulation_sends
  ADD COLUMN IF NOT EXISTS listing_ids uuid[] NOT NULL DEFAULT '{}';

ALTER TABLE public.commercial_circulation_sends
  ADD COLUMN IF NOT EXISTS match_fingerprint text;

CREATE INDEX IF NOT EXISTS commercial_circulation_sends_account_created_idx
  ON public.commercial_circulation_sends (account_id, created_at DESC);

COMMENT ON COLUMN public.commercial_circulation_sends.send_kind IS
  'listing = one disposal; digest = one email of all current matches per contact.';

-- ---------------------------------------------------------------------------
-- New listings participate in auto-send unless turned off
-- ---------------------------------------------------------------------------
ALTER TABLE public.commercial_listings
  ALTER COLUMN auto_circulate_matches SET DEFAULT true;

COMMENT ON COLUMN public.commercial_listings.auto_circulate_matches IS
  'When true, this disposal is included in automatic match-digest triggers.';
