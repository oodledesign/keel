-- Remap commercial_requirements stages to Bracketts WIP-style demand stages.

ALTER TABLE public.commercial_requirements
  DROP CONSTRAINT IF EXISTS commercial_requirements_stage_check;

ALTER TABLE public.commercial_requirements
  ADD CONSTRAINT commercial_requirements_stage_check
  CHECK (
    stage = ANY (
      ARRAY[
        -- Canonical WIP requirement stages
        'new',
        'actively_searching',
        'under_offer_negotiating',
        'fulfilled',
        'withdrawn',
        -- Legacy Kato-style keys (kept readable during/after remap)
        'unactioned',
        'prospect',
        'search',
        'viewing',
        'negotiating',
        'under_offer',
        'success',
        'ongoing',
        'on_hold',
        'unsuccessful'
      ]
    )
  );

COMMENT ON CONSTRAINT commercial_requirements_stage_check ON public.commercial_requirements IS
  'Commercial requirement stages (WIP set + legacy keys for remap).';

ALTER TABLE public.commercial_requirements
  ALTER COLUMN stage SET DEFAULT 'new';

UPDATE public.commercial_requirements
SET
  stage = CASE stage
    WHEN 'unactioned' THEN 'new'
    WHEN 'prospect' THEN 'new'
    WHEN 'search' THEN 'actively_searching'
    WHEN 'viewing' THEN 'actively_searching'
    WHEN 'ongoing' THEN 'actively_searching'
    WHEN 'on_hold' THEN 'actively_searching'
    WHEN 'negotiating' THEN 'under_offer_negotiating'
    WHEN 'under_offer' THEN 'under_offer_negotiating'
    WHEN 'success' THEN 'fulfilled'
    WHEN 'unsuccessful' THEN 'withdrawn'
    ELSE stage
  END,
  updated_at = now()
WHERE stage IN (
  'unactioned',
  'prospect',
  'search',
  'viewing',
  'ongoing',
  'on_hold',
  'negotiating',
  'under_offer',
  'success',
  'unsuccessful'
);
