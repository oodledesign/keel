-- Building-surveyor leads (Bracketts instruction sheet).
--   * New pipeline stages: tob_sent, invoice_sent, survey_sent.
--   * Instruction sheet fields and stage ticks on pipeline_deals.
--   * last_activity_at for traffic lights and the archive prompt.
--   * pipeline_deal_events: stage changes, ticks, archives and reminders.
--
-- Everything is additive. Triggers return early for any workspace that is not
-- building-surveyor, so work CRM and commercial WIP behave as before.

-- ---------------------------------------------------------------------------
-- 1. Stage keys (existing keys kept; three surveyor keys added)
-- ---------------------------------------------------------------------------
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
        'tob_sent',
        'surveyed',
        'reported',
        'invoice_sent',
        'survey_sent',
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

-- ---------------------------------------------------------------------------
-- 2. Instruction sheet fields and stage ticks
-- ---------------------------------------------------------------------------
ALTER TABLE public.pipeline_deals
  ADD COLUMN IF NOT EXISTS assigned_to uuid
    REFERENCES auth.users (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS survey_type text,
  ADD COLUMN IF NOT EXISTS inspection_at timestamptz,
  ADD COLUMN IF NOT EXISTS lead_in_time text,
  ADD COLUMN IF NOT EXISTS property_age text,
  ADD COLUMN IF NOT EXISTS bedrooms integer,
  ADD COLUMN IF NOT EXISTS purchase_price_pence bigint,
  ADD COLUMN IF NOT EXISTS tenure text,
  ADD COLUMN IF NOT EXISTS access_contact_name text,
  ADD COLUMN IF NOT EXISTS access_contact_phone text,
  ADD COLUMN IF NOT EXISTS client_address text,
  ADD COLUMN IF NOT EXISTS solicitor_name text,
  ADD COLUMN IF NOT EXISTS solicitor_email text,
  ADD COLUMN IF NOT EXISTS client_notes text,
  ADD COLUMN IF NOT EXISTS quote_sent_by_phone boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS quote_sent_by_email boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS tob_signed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS tob_signed_at timestamptz,
  ADD COLUMN IF NOT EXISTS report_checked boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS report_checked_by uuid
    REFERENCES auth.users (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS report_checked_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_activity_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE public.pipeline_deals
  DROP CONSTRAINT IF EXISTS pipeline_deals_bedrooms_check;
ALTER TABLE public.pipeline_deals
  ADD CONSTRAINT pipeline_deals_bedrooms_check
  CHECK (bedrooms IS NULL OR bedrooms >= 0);

ALTER TABLE public.pipeline_deals
  DROP CONSTRAINT IF EXISTS pipeline_deals_purchase_price_check;
ALTER TABLE public.pipeline_deals
  ADD CONSTRAINT pipeline_deals_purchase_price_check
  CHECK (purchase_price_pence IS NULL OR purchase_price_pence >= 0);

COMMENT ON COLUMN public.pipeline_deals.assigned_to IS
  'Surveyor responsible for the lead (building-surveyor).';
COMMENT ON COLUMN public.pipeline_deals.survey_type IS
  'Instruction type, e.g. rics_hss_l2, rics_hss_l3, commercial_condition.';
COMMENT ON COLUMN public.pipeline_deals.tob_signed IS
  'Terms of business signed. Required before Report drafted (building-surveyor).';
COMMENT ON COLUMN public.pipeline_deals.last_activity_at IS
  'Latest stage change, tick or update. Drives traffic lights and the archive prompt.';

-- Backfill from the latest of the row update and any attached note.
UPDATE public.pipeline_deals d
SET last_activity_at = GREATEST(
  COALESCE(d.updated_at, d.created_at, now()),
  COALESCE(
    (
      SELECT max(n.created_at)
      FROM public.notes n
      WHERE n.pipeline_deal_id = d.id
    ),
    COALESCE(d.updated_at, d.created_at, now())
  )
);

CREATE INDEX IF NOT EXISTS ix_pipeline_deals_account_last_activity
  ON public.pipeline_deals (account_id, last_activity_at);

-- Draft quotes follow the lead. The hash tells an untouched generated body
-- (safe to regenerate) from one someone has edited.
ALTER TABLE public.proposals
  ADD COLUMN IF NOT EXISTS quote_html_hash text,
  ADD COLUMN IF NOT EXISTS lead_changed_at timestamptz;

COMMENT ON COLUMN public.proposals.quote_html_hash IS
  'SHA-256 of the generated standardised quote HTML (building-surveyor).';
COMMENT ON COLUMN public.proposals.lead_changed_at IS
  'Set when the linked lead changed but the edited quote body was kept.';

-- ---------------------------------------------------------------------------
-- 3. Lead activity events
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.pipeline_deal_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.accounts (id) ON DELETE CASCADE,
  deal_id uuid NOT NULL REFERENCES public.pipeline_deals (id) ON DELETE CASCADE,
  event_type text NOT NULL
    CONSTRAINT pipeline_deal_events_type_check CHECK (
      event_type IN (
        'created',
        'stage_changed',
        'archived',
        'tick_changed',
        'reminder_sent'
      )
    ),
  from_stage text,
  to_stage text,
  detail jsonb NOT NULL DEFAULT '{}'::jsonb,
  actor_id uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.pipeline_deal_events IS
  'Activity log for building-surveyor leads. actor_id NULL = automatic.';

CREATE INDEX IF NOT EXISTS ix_pipeline_deal_events_deal
  ON public.pipeline_deal_events (deal_id, created_at DESC);
CREATE INDEX IF NOT EXISTS ix_pipeline_deal_events_account_type
  ON public.pipeline_deal_events (account_id, event_type, created_at DESC);

ALTER TABLE public.pipeline_deal_events ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.pipeline_deal_events FROM authenticated, service_role;
GRANT SELECT, INSERT ON public.pipeline_deal_events TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pipeline_deal_events TO service_role;

DROP POLICY IF EXISTS pipeline_deal_events_read ON public.pipeline_deal_events;
CREATE POLICY pipeline_deal_events_read ON public.pipeline_deal_events
  FOR SELECT TO authenticated
  USING (public.has_role_on_account (account_id));

DROP POLICY IF EXISTS pipeline_deal_events_insert ON public.pipeline_deal_events;
CREATE POLICY pipeline_deal_events_insert ON public.pipeline_deal_events
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role_on_account (account_id)
    AND actor_id = auth.uid ()
    AND EXISTS (
      SELECT 1 FROM public.pipeline_deals d
      WHERE d.id = deal_id AND d.account_id = pipeline_deal_events.account_id
    )
  );

-- ---------------------------------------------------------------------------
-- 4. Triggers (building-surveyor only)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_building_surveyor_account (p_account_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.accounts a
    WHERE a.id = p_account_id AND a.space_type = 'building-surveyor'
  );
$$;

REVOKE ALL ON FUNCTION public.is_building_surveyor_account (uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.is_building_surveyor_account (uuid)
  TO authenticated, service_role;

-- Stamp activity on stage changes before the row is written.
CREATE OR REPLACE FUNCTION public.pipeline_deals_touch_activity ()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF NOT public.is_building_surveyor_account (NEW.account_id) THEN
    RETURN NEW;
  END IF;
  NEW.last_activity_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS pipeline_deals_touch_activity_on_stage
  ON public.pipeline_deals;
CREATE TRIGGER pipeline_deals_touch_activity_on_stage
  BEFORE UPDATE OF stage ON public.pipeline_deals
  FOR EACH ROW
  WHEN (OLD.stage IS DISTINCT FROM NEW.stage)
  EXECUTE FUNCTION public.pipeline_deals_touch_activity ();

-- Log creation and stage changes.
CREATE OR REPLACE FUNCTION public.pipeline_deals_log_event ()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.account_id IS NULL
    OR NOT public.is_building_surveyor_account (NEW.account_id) THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.pipeline_deal_events (
      account_id, deal_id, event_type, to_stage, actor_id
    ) VALUES (
      NEW.account_id, NEW.id, 'created', NEW.stage, auth.uid ()
    );
  ELSE
    INSERT INTO public.pipeline_deal_events (
      account_id, deal_id, event_type, from_stage, to_stage, actor_id
    ) VALUES (
      NEW.account_id, NEW.id, 'stage_changed', OLD.stage, NEW.stage, auth.uid ()
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS pipeline_deals_log_insert ON public.pipeline_deals;
CREATE TRIGGER pipeline_deals_log_insert
  AFTER INSERT ON public.pipeline_deals
  FOR EACH ROW
  EXECUTE FUNCTION public.pipeline_deals_log_event ();

DROP TRIGGER IF EXISTS pipeline_deals_log_stage_change ON public.pipeline_deals;
CREATE TRIGGER pipeline_deals_log_stage_change
  AFTER UPDATE OF stage ON public.pipeline_deals
  FOR EACH ROW
  WHEN (OLD.stage IS DISTINCT FROM NEW.stage)
  EXECUTE FUNCTION public.pipeline_deals_log_event ();

-- A manual update (note) on a lead counts as activity.
CREATE OR REPLACE FUNCTION public.notes_touch_pipeline_deal_activity ()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  UPDATE public.pipeline_deals d
  SET last_activity_at = now()
  WHERE d.id = NEW.pipeline_deal_id
    AND public.is_building_surveyor_account (d.account_id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS notes_touch_pipeline_deal_activity ON public.notes;
CREATE TRIGGER notes_touch_pipeline_deal_activity
  AFTER INSERT ON public.notes
  FOR EACH ROW
  WHEN (NEW.pipeline_deal_id IS NOT NULL)
  EXECUTE FUNCTION public.notes_touch_pipeline_deal_activity ();

NOTIFY pgrst, 'reload schema';
