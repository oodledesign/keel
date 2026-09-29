-- Circulation send-state moves out of the consent table.
--
-- 20261231120000 stored last_circulated_at / circulation_claimed_at on
-- commercial_marketing_preferences and claimed a contact with an UPDATE. A
-- contact who has never opted in has no preference row (consent is "unknown"),
-- so the claim matched nothing and manual sends to them were skipped as
-- "claimed". Inserting a consent row is not an option: marketing_status
-- defaults to 'subscribed', which would silently opt the contact in to auto
-- sends. Send-state gets its own table, independent of consent.

CREATE TABLE IF NOT EXISTS public.commercial_circulation_contact_state (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.accounts (id) ON DELETE CASCADE,
  email text NOT NULL,
  last_circulated_at timestamptz,
  circulation_claimed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT commercial_circulation_contact_state_uidx
    UNIQUE (account_id, email)
);

CREATE INDEX IF NOT EXISTS commercial_circulation_contact_state_circulated_idx
  ON public.commercial_circulation_contact_state (
    account_id, last_circulated_at NULLS FIRST
  );

COMMENT ON TABLE public.commercial_circulation_contact_state IS
  'Per-contact circulation send state (last email, in-flight claim). Holds no consent: a row here says nothing about whether the contact may be emailed.';
COMMENT ON COLUMN public.commercial_circulation_contact_state.last_circulated_at IS
  'When this contact was last emailed any circulation (digest or single listing).';
COMMENT ON COLUMN public.commercial_circulation_contact_state.circulation_claimed_at IS
  'Set while a send is in flight so concurrent runs skip this contact. Stale after 10 minutes.';

ALTER TABLE public.commercial_circulation_contact_state ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.commercial_circulation_contact_state
  FROM authenticated, service_role;
GRANT SELECT, INSERT, UPDATE ON public.commercial_circulation_contact_state
  TO authenticated;
GRANT ALL ON public.commercial_circulation_contact_state TO service_role;

DROP POLICY IF EXISTS commercial_circulation_contact_state_select
  ON public.commercial_circulation_contact_state;
CREATE POLICY commercial_circulation_contact_state_select
  ON public.commercial_circulation_contact_state
  FOR SELECT TO authenticated
  USING (public.has_role_on_account(account_id));

DROP POLICY IF EXISTS commercial_circulation_contact_state_insert
  ON public.commercial_circulation_contact_state;
CREATE POLICY commercial_circulation_contact_state_insert
  ON public.commercial_circulation_contact_state
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role_on_account(account_id));

DROP POLICY IF EXISTS commercial_circulation_contact_state_update
  ON public.commercial_circulation_contact_state;
CREATE POLICY commercial_circulation_contact_state_update
  ON public.commercial_circulation_contact_state
  FOR UPDATE TO authenticated
  USING (public.has_role_on_account(account_id))
  WITH CHECK (public.has_role_on_account(account_id));

-- Carry over what 20261231120000 already recorded on the consent table.
INSERT INTO public.commercial_circulation_contact_state (
  account_id, email, last_circulated_at, circulation_claimed_at
)
SELECT account_id, email, last_circulated_at, circulation_claimed_at
FROM public.commercial_marketing_preferences
WHERE last_circulated_at IS NOT NULL
   OR circulation_claimed_at IS NOT NULL
ON CONFLICT (account_id, email) DO NOTHING;

-- Same signature as before, so callers do not change. Upserts the state row,
-- then claims it only if no fresh claim exists and (when asked) the contact
-- has not been emailed since p_not_circulated_since. Single statement, so the
-- claim is atomic under concurrent runs.
CREATE OR REPLACE FUNCTION public.claim_commercial_circulation_contact(
  p_account_id uuid,
  p_email text,
  p_not_circulated_since timestamptz DEFAULT NULL
)
RETURNS boolean
LANGUAGE sql
SECURITY INVOKER
SET search_path = ''
AS $$
  WITH claimed AS (
    INSERT INTO public.commercial_circulation_contact_state AS s (
      account_id, email, circulation_claimed_at
    )
    VALUES (p_account_id, p_email, now())
    ON CONFLICT (account_id, email) DO UPDATE
      SET circulation_claimed_at = now(),
          updated_at = now()
      WHERE (
          s.circulation_claimed_at IS NULL
          OR s.circulation_claimed_at < now() - interval '10 minutes'
        )
        AND (
          p_not_circulated_since IS NULL
          OR s.last_circulated_at IS NULL
          OR s.last_circulated_at < p_not_circulated_since
        )
    RETURNING s.id
  )
  SELECT EXISTS (SELECT 1 FROM claimed);
$$;

COMMENT ON FUNCTION public.claim_commercial_circulation_contact(uuid, text, timestamptz) IS
  'Claims a contact for one circulation send, creating their send-state row if needed (no consent implied). Returns false if another run holds a fresh claim or the contact was emailed since p_not_circulated_since.';

REVOKE ALL ON FUNCTION public.claim_commercial_circulation_contact(uuid, text, timestamptz) FROM public;
GRANT EXECUTE ON FUNCTION public.claim_commercial_circulation_contact(uuid, text, timestamptz)
  TO authenticated, service_role;

-- The old columns stay until the new code is live everywhere; drop them in a
-- follow-up migration.
COMMENT ON COLUMN public.commercial_marketing_preferences.last_circulated_at IS
  'DEPRECATED: superseded by commercial_circulation_contact_state.last_circulated_at.';
COMMENT ON COLUMN public.commercial_marketing_preferences.circulation_claimed_at IS
  'DEPRECATED: superseded by commercial_circulation_contact_state.circulation_claimed_at.';
