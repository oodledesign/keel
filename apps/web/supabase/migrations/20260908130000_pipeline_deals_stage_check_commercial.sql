-- Allow commercial Kato pipeline stages on pipeline_deals (in addition to work CRM stages).
-- Previously the CHECK only listed work stages, so commercial board create/move failed.

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
        -- Commercial / Kato
        'shortlisted',
        'enquiry',
        'viewing',
        'negotiating',
        'under_offer',
        'signed',
        'idle',
        'discounted',
        -- Legacy commercial keys (pre-remap; keep readable)
        'offer',
        'hots',
        'solicitors',
        'completed',
        'fell_through'
      ]
    )
  );

COMMENT ON CONSTRAINT pipeline_deals_stage_check ON public.pipeline_deals IS
  'Work CRM + commercial Kato pipeline stage keys.';
