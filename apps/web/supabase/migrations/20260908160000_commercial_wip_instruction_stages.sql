-- Remap commercial Instruction stages to Bracketts WIP language,
-- and allow a customisable board name (default "WIP").

ALTER TABLE public.pipeline_board_stage_settings
  ADD COLUMN IF NOT EXISTS board_name text NOT NULL DEFAULT 'WIP';

COMMENT ON COLUMN public.pipeline_board_stage_settings.board_name IS
  'Commercial workspace display name for the Instructions board (default WIP).';

-- Allow new WIP keys (keep legacy keys readable during remaps / orphan columns).
ALTER TABLE public.pipeline_deals
  DROP CONSTRAINT IF EXISTS pipeline_deals_stage_check;

ALTER TABLE public.pipeline_deals
  ADD CONSTRAINT pipeline_deals_stage_check
  CHECK (
    stage = ANY (
      ARRAY[
        -- Work CRM
        'lead',
        'qualified',
        'call_booked',
        'proposal_sent',
        'negotiation',
        'won',
        'lost',
        -- Commercial WIP Instructions
        'potential',
        'current',
        'under_offer_negotiating',
        'completed_exchanged',
        'fallen_through',
        -- Legacy Kato / pre-WIP (normalize via app + this migration)
        'shortlisted',
        'enquiry',
        'viewing',
        'negotiating',
        'under_offer',
        'signed',
        'idle',
        'discounted',
        'offer',
        'hots',
        'solicitors',
        'completed',
        'fell_through'
      ]
    )
  );

COMMENT ON CONSTRAINT pipeline_deals_stage_check ON public.pipeline_deals IS
  'Work CRM + commercial WIP Instruction stages (legacy keys kept for remap).';

-- Remap commercial-property deals into WIP stage keys.
UPDATE public.pipeline_deals AS d
SET
  stage = CASE d.stage
    WHEN 'shortlisted' THEN 'potential'
    WHEN 'enquiry' THEN 'potential'
    WHEN 'idle' THEN 'potential'
    WHEN 'viewing' THEN 'current'
    WHEN 'negotiating' THEN 'under_offer_negotiating'
    WHEN 'under_offer' THEN 'under_offer_negotiating'
    WHEN 'offer' THEN 'under_offer_negotiating'
    WHEN 'hots' THEN 'under_offer_negotiating'
    WHEN 'solicitors' THEN 'under_offer_negotiating'
    WHEN 'signed' THEN 'completed_exchanged'
    WHEN 'completed' THEN 'completed_exchanged'
    WHEN 'discounted' THEN 'fallen_through'
    WHEN 'fell_through' THEN 'fallen_through'
    ELSE d.stage
  END,
  completed_at = CASE
    WHEN d.stage IN ('signed', 'completed') AND d.completed_at IS NULL THEN now()
    WHEN d.stage IN ('discounted', 'fell_through') THEN NULL
    ELSE d.completed_at
  END
FROM public.accounts AS a
WHERE d.account_id = a.id
  AND a.space_type = 'commercial-property'
  AND d.stage IN (
    'shortlisted',
    'enquiry',
    'idle',
    'viewing',
    'negotiating',
    'under_offer',
    'offer',
    'hots',
    'solicitors',
    'signed',
    'completed',
    'discounted',
    'fell_through'
  );

-- Reset commercial board stage settings to WIP defaults (labels).
UPDATE public.pipeline_board_stage_settings AS s
SET
  stages = '[
    {"key":"potential","label":"Potential Instructions","hidden":false},
    {"key":"current","label":"Current Instructions","hidden":false},
    {"key":"under_offer_negotiating","label":"Under Offer / Negotiating","hidden":false},
    {"key":"completed_exchanged","label":"Completed / Exchanged","hidden":false},
    {"key":"fallen_through","label":"Fallen through","hidden":false}
  ]'::jsonb,
  board_name = COALESCE(NULLIF(trim(s.board_name), ''), 'WIP'),
  updated_at = now()
FROM public.accounts AS a
WHERE s.account_id = a.id
  AND a.space_type = 'commercial-property';
