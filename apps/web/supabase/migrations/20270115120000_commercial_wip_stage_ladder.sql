-- Split commercial WIP instruction stages into Abbey's ladder and add
-- per-instruction AML done tracking.
--
-- Dan: apply this on production manually. It only rewrites deals on
-- commercial-property accounts.
--
-- Stage mapping (mirrors apps/web/lib/commercial/wip-stage-migration.ts):
--   under_offer_negotiating -> under_offer
--   completed_exchanged     -> billed when name/notes/hots_notes/next_action
--                              contains the word "billed"; otherwise completed
--   work_type = management and stage in (current, potential) -> managed
-- Legacy keys stay valid so older clients still read. The app maps them.

ALTER TABLE public.pipeline_deals
  ADD COLUMN IF NOT EXISTS aml_done boolean NOT NULL DEFAULT false;

ALTER TABLE public.pipeline_deals
  ADD COLUMN IF NOT EXISTS aml_done_at timestamptz;

ALTER TABLE public.pipeline_deals
  ADD COLUMN IF NOT EXISTS aml_done_by uuid REFERENCES auth.users (id) ON DELETE SET NULL;

COMMENT ON COLUMN public.pipeline_deals.aml_done IS
  'Instruction AML marked done. Cleared together with aml_done_at / aml_done_by.';
COMMENT ON COLUMN public.pipeline_deals.aml_done_at IS
  'When AML was last marked done on this instruction.';
COMMENT ON COLUMN public.pipeline_deals.aml_done_by IS
  'User who last marked AML done on this instruction.';

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
        -- Commercial WIP ladder
        'billed',
        'completed',
        'under_offer',
        'negotiating',
        'current',
        'potential',
        'managed',
        'fallen_through',
        -- Previous combined WIP keys (readable; app + this migration remap them)
        'under_offer_negotiating',
        'completed_exchanged',
        -- Building Surveyor
        'quoted',
        'accepted',
        'booked',
        'surveyed',
        'reported',
        -- Legacy Kato / pre-WIP
        'shortlisted',
        'enquiry',
        'viewing',
        'signed',
        'idle',
        'discounted',
        'offer',
        'hots',
        'solicitors',
        'fell_through'
      ]
    )
  );

COMMENT ON CONSTRAINT pipeline_deals_stage_check ON public.pipeline_deals IS
  'Work CRM + commercial WIP ladder + building-surveyor stages (legacy keys kept).';

-- Remap combined stages and management-in-current onto the ladder.
-- Order matches remapStoredCommercialInstructionStage.
UPDATE public.pipeline_deals AS d
SET
  stage = CASE
    WHEN d.stage = 'under_offer_negotiating' THEN 'under_offer'
    WHEN d.stage = 'completed_exchanged'
      AND (
        COALESCE(d.name, '') ~* '(^|[^[:alnum:]])billed([^[:alnum:]]|$)'
        OR COALESCE(d.notes, '') ~* '(^|[^[:alnum:]])billed([^[:alnum:]]|$)'
        OR COALESCE(d.hots_notes, '') ~* '(^|[^[:alnum:]])billed([^[:alnum:]]|$)'
        OR COALESCE(d.next_action, '') ~* '(^|[^[:alnum:]])billed([^[:alnum:]]|$)'
      ) THEN 'billed'
    WHEN d.stage = 'completed_exchanged' THEN 'completed'
    WHEN d.work_type = 'management'
      AND d.stage IN ('current', 'potential') THEN 'managed'
    ELSE d.stage
  END,
  updated_at = now()
FROM public.accounts AS a
WHERE d.account_id = a.id
  AND a.space_type = 'commercial-property'
  AND (
    d.stage IN ('under_offer_negotiating', 'completed_exchanged')
    OR (
      d.work_type = 'management'
      AND d.stage IN ('current', 'potential')
    )
  );

-- Rebuild board columns in ladder order. Keep a custom label or hidden
-- flag when the key still exists; new keys use the default label.
UPDATE public.pipeline_board_stage_settings AS s
SET
  stages = (
    SELECT jsonb_agg(
      jsonb_build_object(
        'key', def.key,
        'label', COALESCE(existing.label, def.label),
        'hidden', COALESCE(existing.hidden, false)
      )
      ORDER BY def.ord
    )
    FROM (
      VALUES
        (1, 'billed', 'Billed'),
        (2, 'completed', 'Completed'),
        (3, 'under_offer', 'Under offer'),
        (4, 'negotiating', 'Negotiating'),
        (5, 'current', 'Current Instructions'),
        (6, 'potential', 'Potential Instructions'),
        (7, 'managed', 'Managed'),
        (8, 'fallen_through', 'Fallen through')
    ) AS def (ord, key, label)
    LEFT JOIN LATERAL (
      SELECT
        NULLIF(item->>'label', '') AS label,
        CASE
          WHEN jsonb_typeof(item->'hidden') = 'boolean'
            THEN (item->>'hidden')::boolean
          ELSE NULL
        END AS hidden
      FROM jsonb_array_elements(
        CASE
          WHEN jsonb_typeof(COALESCE(s.stages, '[]'::jsonb)) = 'array'
            THEN COALESCE(s.stages, '[]'::jsonb)
          ELSE '[]'::jsonb
        END
      ) AS item
      WHERE item->>'key' = def.key
      LIMIT 1
    ) AS existing ON true
  ),
  updated_at = now()
FROM public.accounts AS a
WHERE s.account_id = a.id
  AND a.space_type = 'commercial-property';
