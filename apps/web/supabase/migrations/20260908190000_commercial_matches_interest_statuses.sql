-- Evolve commercial_matches into a lightweight Interest Schedule status set.

ALTER TABLE public.commercial_matches
  ADD COLUMN IF NOT EXISTS last_activity_at timestamptz NOT NULL DEFAULT now();

UPDATE public.commercial_matches
SET last_activity_at = COALESCE(updated_at, created_at, now())
WHERE last_activity_at IS NULL
   OR last_activity_at < COALESCE(updated_at, created_at, now());

ALTER TABLE public.commercial_matches
  DROP CONSTRAINT IF EXISTS commercial_matches_status_check;

ALTER TABLE public.commercial_matches
  ADD CONSTRAINT commercial_matches_status_check
  CHECK (
    status = ANY (
      ARRAY[
        -- Canonical interest statuses
        'new',
        'viewing_arranged',
        'viewed',
        'offer_made',
        'negotiating',
        'under_offer',
        'agreed',
        'withdrawn',
        'lost',
        -- Legacy Kato/deal-shaped keys
        'shortlisted',
        'enquiry',
        'viewing',
        'signed',
        'idle',
        'discounted'
      ]
    )
  );

ALTER TABLE public.commercial_matches
  ALTER COLUMN status SET DEFAULT 'new';

UPDATE public.commercial_matches
SET
  status = CASE status
    WHEN 'shortlisted' THEN 'new'
    WHEN 'enquiry' THEN 'new'
    WHEN 'idle' THEN 'new'
    WHEN 'viewing' THEN 'viewing_arranged'
    WHEN 'signed' THEN 'agreed'
    WHEN 'discounted' THEN 'lost'
    ELSE status
  END,
  updated_at = now(),
  last_activity_at = now()
WHERE status IN (
  'shortlisted',
  'enquiry',
  'idle',
  'viewing',
  'signed',
  'discounted'
);

CREATE INDEX IF NOT EXISTS commercial_matches_requirement_id_idx
  ON public.commercial_matches (requirement_id);

CREATE INDEX IF NOT EXISTS commercial_matches_last_activity_idx
  ON public.commercial_matches (account_id, last_activity_at DESC);

COMMENT ON COLUMN public.commercial_matches.last_activity_at IS
  'Bumped when interest status or notes change.';
