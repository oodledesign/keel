-- Allow multiple Google accounts per Ozer user (e.g. work + personal).
-- Was: one row keyed by user_id. Now: many rows keyed by id, unique on (user_id, google_account_sub).

ALTER TABLE public.google_calendar_connections
  ADD COLUMN IF NOT EXISTS id uuid,
  ADD COLUMN IF NOT EXISTS google_account_email text,
  ADD COLUMN IF NOT EXISTS google_account_sub text,
  ADD COLUMN IF NOT EXISTS is_primary boolean NOT NULL DEFAULT true;

UPDATE public.google_calendar_connections
SET id = gen_random_uuid()
WHERE id IS NULL;

ALTER TABLE public.google_calendar_connections
  ALTER COLUMN id SET DEFAULT gen_random_uuid(),
  ALTER COLUMN id SET NOT NULL;

-- Existing single-row connections become primary until the user reconnects and we
-- learn Google account identity. Placeholder sub keeps uniqueness workable.
UPDATE public.google_calendar_connections
SET google_account_sub = 'legacy:' || user_id::text
WHERE google_account_sub IS NULL;

ALTER TABLE public.google_calendar_connections
  ALTER COLUMN google_account_sub SET NOT NULL;

ALTER TABLE public.google_calendar_connections
  DROP CONSTRAINT IF EXISTS google_calendar_connections_pkey;

ALTER TABLE public.google_calendar_connections
  ADD PRIMARY KEY (id);

CREATE UNIQUE INDEX IF NOT EXISTS google_calendar_connections_user_sub_uidx
  ON public.google_calendar_connections (user_id, google_account_sub);

CREATE UNIQUE INDEX IF NOT EXISTS google_calendar_connections_user_email_uidx
  ON public.google_calendar_connections (user_id, lower(google_account_email))
  WHERE google_account_email IS NOT NULL;

-- At most one primary write account per user (Meet links, planner events).
CREATE UNIQUE INDEX IF NOT EXISTS google_calendar_connections_user_primary_uidx
  ON public.google_calendar_connections (user_id)
  WHERE is_primary;

CREATE INDEX IF NOT EXISTS google_calendar_connections_user_id_idx
  ON public.google_calendar_connections (user_id);

COMMENT ON COLUMN public.google_calendar_connections.google_account_email IS
  'Email of the connected Google account (from OpenID userinfo).';

COMMENT ON COLUMN public.google_calendar_connections.google_account_sub IS
  'Google OpenID subject; unique with user_id so the same Google inbox can be reconnected.';

COMMENT ON COLUMN public.google_calendar_connections.is_primary IS
  'When true, this account is used for writing events / Meet links. Busy checks use all accounts.';
