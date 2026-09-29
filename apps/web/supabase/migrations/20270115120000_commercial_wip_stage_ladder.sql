-- Split commercial WIP instruction stages into Abbey's ladder and add
-- per-instruction AML done tracking.
--
-- Dan: apply this on production manually. It does not rewrite deal stages.
-- Bracketts move existing instructions onto Billed, Completed (Unbilled), Under offer,
-- Negotiating, and Managed themselves. New columns start empty.
--
-- Legacy keys stay valid so older rows still read. Combined keys
-- (under_offer_negotiating, completed_exchanged) stay on their own columns.

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
        -- Previous combined WIP keys (left in place for the team to move)
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

-- Existing commercial-property deals are not updated. Staff drag them.

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
        (2, 'completed', 'Completed (Unbilled)'),
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
