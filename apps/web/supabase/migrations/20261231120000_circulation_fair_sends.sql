-- Circulation: change-only sends, fair ordering, send claims, frequency gap,
-- and unsubscribe provenance for reviewing scanner-triggered unsubscribes.

-- ---------------------------------------------------------------------------
-- Contact-level send state + unsubscribe provenance
-- ---------------------------------------------------------------------------
ALTER TABLE public.commercial_marketing_preferences
  ADD COLUMN IF NOT EXISTS last_circulated_at timestamptz,
  ADD COLUMN IF NOT EXISTS circulation_claimed_at timestamptz,
  ADD COLUMN IF NOT EXISTS unsubscribe_source text,
  ADD COLUMN IF NOT EXISTS unsubscribe_reviewed_at timestamptz;

ALTER TABLE public.commercial_marketing_preferences
  DROP CONSTRAINT IF EXISTS commercial_marketing_preferences_unsubscribe_source_check;

ALTER TABLE public.commercial_marketing_preferences
  ADD CONSTRAINT commercial_marketing_preferences_unsubscribe_source_check
  CHECK (
    unsubscribe_source IS NULL
    OR unsubscribe_source IN ('one_click', 'confirm_page', 'preferences_page')
  );

COMMENT ON COLUMN public.commercial_marketing_preferences.last_circulated_at IS
  'When this contact was last emailed any circulation (digest or single listing).';
COMMENT ON COLUMN public.commercial_marketing_preferences.circulation_claimed_at IS
  'Set while a send is in flight so concurrent runs skip this contact. Stale after 10 minutes.';
COMMENT ON COLUMN public.commercial_marketing_preferences.unsubscribe_source IS
  'How the unsubscribe happened. NULL on legacy rows, when the email link unsubscribed on GET.';
COMMENT ON COLUMN public.commercial_marketing_preferences.unsubscribe_reviewed_at IS
  'Set when an agent dismisses a suspected scanner-triggered unsubscribe.';

UPDATE public.commercial_marketing_preferences p
SET last_circulated_at = sub.last_sent_at
FROM (
  SELECT r.account_id, lower(trim(r.email)) AS email, max(r.created_at) AS last_sent_at
  FROM public.commercial_circulation_recipients r
  WHERE r.status = 'sent'
  GROUP BY r.account_id, lower(trim(r.email))
) sub
WHERE p.account_id = sub.account_id
  AND p.email = sub.email
  AND p.last_circulated_at IS NULL;

UPDATE public.commercial_marketing_preferences
SET last_circulated_at = last_digest_sent_at
WHERE last_circulated_at IS NULL
  AND last_digest_sent_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS commercial_marketing_preferences_account_circulated_idx
  ON public.commercial_marketing_preferences (account_id, last_circulated_at NULLS FIRST);

-- ---------------------------------------------------------------------------
-- Workspace minimum gap between automatic emails to the same contact
-- ---------------------------------------------------------------------------
ALTER TABLE public.commercial_circulation_settings
  ADD COLUMN IF NOT EXISTS min_gap_days integer NOT NULL DEFAULT 5;

ALTER TABLE public.commercial_circulation_settings
  DROP CONSTRAINT IF EXISTS commercial_circulation_settings_min_gap_days_check;

ALTER TABLE public.commercial_circulation_settings
  ADD CONSTRAINT commercial_circulation_settings_min_gap_days_check
  CHECK (min_gap_days BETWEEN 0 AND 60);

COMMENT ON COLUMN public.commercial_circulation_settings.min_gap_days IS
  'Minimum days between automatic circulation emails to the same contact.';

-- ---------------------------------------------------------------------------
-- Listings actually shown to each contact
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.commercial_circulation_sent_listings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.accounts (id) ON DELETE CASCADE,
  email text NOT NULL,
  listing_id uuid NOT NULL REFERENCES public.commercial_listings (id) ON DELETE CASCADE,
  first_sent_at timestamptz NOT NULL DEFAULT now(),
  last_sent_at timestamptz NOT NULL DEFAULT now(),
  last_send_id uuid REFERENCES public.commercial_circulation_sends (id) ON DELETE SET NULL,
  CONSTRAINT commercial_circulation_sent_listings_uidx
    UNIQUE (account_id, email, listing_id)
);

CREATE INDEX IF NOT EXISTS commercial_circulation_sent_listings_listing_idx
  ON public.commercial_circulation_sent_listings (listing_id);

COMMENT ON TABLE public.commercial_circulation_sent_listings IS
  'One row per contact + listing that appeared in a sent circulation email. Drives change-only sends.';

ALTER TABLE public.commercial_circulation_sent_listings ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.commercial_circulation_sent_listings FROM authenticated, service_role;
GRANT SELECT, INSERT, UPDATE ON public.commercial_circulation_sent_listings TO authenticated;
GRANT ALL ON public.commercial_circulation_sent_listings TO service_role;

DROP POLICY IF EXISTS commercial_circulation_sent_listings_select
  ON public.commercial_circulation_sent_listings;
CREATE POLICY commercial_circulation_sent_listings_select
  ON public.commercial_circulation_sent_listings
  FOR SELECT TO authenticated
  USING (public.has_role_on_account(account_id));

DROP POLICY IF EXISTS commercial_circulation_sent_listings_insert
  ON public.commercial_circulation_sent_listings;
CREATE POLICY commercial_circulation_sent_listings_insert
  ON public.commercial_circulation_sent_listings
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role_on_account(account_id));

DROP POLICY IF EXISTS commercial_circulation_sent_listings_update
  ON public.commercial_circulation_sent_listings;
CREATE POLICY commercial_circulation_sent_listings_update
  ON public.commercial_circulation_sent_listings
  FOR UPDATE TO authenticated
  USING (public.has_role_on_account(account_id))
  WITH CHECK (public.has_role_on_account(account_id));

-- Backfill from the per-recipient email log (listing_ids is per contact there;
-- commercial_circulation_sends.listing_ids is the union across a whole run).
INSERT INTO public.commercial_circulation_sent_listings (
  account_id, email, listing_id, first_sent_at, last_sent_at
)
SELECT
  log.account_id,
  lower(trim(log.recipient_email)),
  shown.listing_id,
  min(log.created_at),
  max(log.created_at)
FROM public.platform_email_log log
CROSS JOIN LATERAL (
  SELECT (value #>> '{}')::uuid AS listing_id
  FROM jsonb_array_elements(
    CASE
      WHEN jsonb_typeof(log.metadata -> 'listing_ids') = 'array'
        THEN log.metadata -> 'listing_ids'
      WHEN log.metadata -> 'listing_id' IS NOT NULL
        THEN jsonb_build_array(log.metadata -> 'listing_id')
      ELSE '[]'::jsonb
    END
  )
  WHERE (value #>> '{}') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
) shown
JOIN public.commercial_listings l
  ON l.id = shown.listing_id AND l.account_id = log.account_id
WHERE log.email_type = 'commercial_circulation'
  AND log.status = 'sent'
  AND log.account_id IS NOT NULL
GROUP BY log.account_id, lower(trim(log.recipient_email)), shown.listing_id
ON CONFLICT (account_id, email, listing_id) DO NOTHING;

-- Fallback: the last digest fingerprint is the sorted listing ids of that contact's last email.
INSERT INTO public.commercial_circulation_sent_listings (
  account_id, email, listing_id, first_sent_at, last_sent_at
)
SELECT
  p.account_id,
  p.email,
  l.id,
  coalesce(p.last_digest_sent_at, now()),
  coalesce(p.last_digest_sent_at, now())
FROM public.commercial_marketing_preferences p
CROSS JOIN LATERAL unnest(string_to_array(p.last_digest_fingerprint, ',')) AS fp(listing_id)
JOIN public.commercial_listings l
  ON l.account_id = p.account_id
  AND l.id::text = trim(fp.listing_id)
WHERE p.last_digest_fingerprint IS NOT NULL
  AND p.last_digest_fingerprint <> ''
ON CONFLICT (account_id, email, listing_id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Atomic per-contact claim before sending
-- ---------------------------------------------------------------------------
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
    UPDATE public.commercial_marketing_preferences
    SET circulation_claimed_at = now()
    WHERE account_id = p_account_id
      AND email = p_email
      AND purpose = 'matching_disposals'
      AND (
        circulation_claimed_at IS NULL
        OR circulation_claimed_at < now() - interval '10 minutes'
      )
      AND (
        p_not_circulated_since IS NULL
        OR last_circulated_at IS NULL
        OR last_circulated_at < p_not_circulated_since
      )
    RETURNING id
  )
  SELECT EXISTS (SELECT 1 FROM claimed);
$$;

COMMENT ON FUNCTION public.claim_commercial_circulation_contact(uuid, text, timestamptz) IS
  'Claims a contact for one circulation send. Returns false if another run holds a fresh claim or the contact was emailed since p_not_circulated_since.';

REVOKE ALL ON FUNCTION public.claim_commercial_circulation_contact(uuid, text, timestamptz) FROM public;
GRANT EXECUTE ON FUNCTION public.claim_commercial_circulation_contact(uuid, text, timestamptz)
  TO authenticated, service_role;
