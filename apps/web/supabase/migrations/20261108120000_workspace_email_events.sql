-- Workspace email analytics: SES events for campaigns + commercial circulation.
-- Admin Zeptomail email_events / email_campaign_metrics stay separate.

-- ---------------------------------------------------------------------------
-- workspace_email_events (shared event log keyed by SES MessageId)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.workspace_email_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid REFERENCES public.accounts (id) ON DELETE CASCADE,
  source text NOT NULL
    CHECK (source IN ('campaign', 'circulation')),
  campaign_id uuid REFERENCES public.workspace_email_campaigns (id) ON DELETE CASCADE,
  campaign_recipient_id uuid REFERENCES public.workspace_email_campaign_recipients (id) ON DELETE CASCADE,
  circulation_send_id uuid REFERENCES public.commercial_circulation_sends (id) ON DELETE CASCADE,
  circulation_recipient_id uuid REFERENCES public.commercial_circulation_recipients (id) ON DELETE CASCADE,
  ses_message_id text NOT NULL,
  event_type text NOT NULL
    CHECK (event_type IN (
      'send',
      'delivery',
      'bounce',
      'complaint',
      'open',
      'click',
      'reject',
      'rendering_failure',
      'delivery_delay'
    )),
  event_at timestamptz NOT NULL DEFAULT now(),
  link_url text,
  bounce_type text,
  bounce_subtype text,
  complaint_feedback_type text,
  sns_message_id text,
  raw_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT workspace_email_events_source_refs CHECK (
    (source = 'campaign' AND campaign_recipient_id IS NOT NULL)
    OR (source = 'circulation' AND circulation_recipient_id IS NOT NULL)
    OR (campaign_recipient_id IS NULL AND circulation_recipient_id IS NULL)
  )
);

COMMENT ON TABLE public.workspace_email_events IS
  'SES configuration-set events for workspace campaigns and commercial circulation (not admin Zeptomail).';

CREATE UNIQUE INDEX IF NOT EXISTS ux_workspace_email_events_sns_message_id
  ON public.workspace_email_events (sns_message_id)
  WHERE sns_message_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS ux_workspace_email_events_once_per_type
  ON public.workspace_email_events (ses_message_id, event_type)
  WHERE event_type IN ('send', 'delivery', 'bounce', 'complaint', 'reject');

CREATE INDEX IF NOT EXISTS ix_workspace_email_events_ses_message_id
  ON public.workspace_email_events (ses_message_id);

CREATE INDEX IF NOT EXISTS ix_workspace_email_events_campaign
  ON public.workspace_email_events (campaign_id, event_type)
  WHERE campaign_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS ix_workspace_email_events_circulation_send
  ON public.workspace_email_events (circulation_send_id, event_type)
  WHERE circulation_send_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS ix_workspace_email_events_account_created
  ON public.workspace_email_events (account_id, created_at DESC);

CREATE INDEX IF NOT EXISTS ix_workspace_email_campaign_recipients_ses_message_id
  ON public.workspace_email_campaign_recipients (ses_message_id)
  WHERE ses_message_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS ix_commercial_circulation_recipients_ses_message_id
  ON public.commercial_circulation_recipients (ses_message_id)
  WHERE ses_message_id IS NOT NULL;

ALTER TABLE public.workspace_email_events ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.workspace_email_events FROM anon, authenticated, service_role;
GRANT SELECT ON public.workspace_email_events TO authenticated;
GRANT ALL ON public.workspace_email_events TO service_role;

DROP POLICY IF EXISTS workspace_email_events_select ON public.workspace_email_events;
CREATE POLICY workspace_email_events_select ON public.workspace_email_events
  FOR SELECT TO authenticated
  USING (
    account_id IS NOT NULL
    AND public.has_role_on_account(account_id)
  );

DROP POLICY IF EXISTS workspace_email_events_service_role ON public.workspace_email_events;
CREATE POLICY workspace_email_events_service_role ON public.workspace_email_events
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

-- ---------------------------------------------------------------------------
-- Denormalized engagement columns on campaign recipients + campaigns
-- ---------------------------------------------------------------------------
ALTER TABLE public.workspace_email_campaign_recipients
  ADD COLUMN IF NOT EXISTS delivered_at timestamptz,
  ADD COLUMN IF NOT EXISTS opened_at timestamptz,
  ADD COLUMN IF NOT EXISTS open_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS clicked_at timestamptz,
  ADD COLUMN IF NOT EXISTS click_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS bounced_at timestamptz,
  ADD COLUMN IF NOT EXISTS bounce_type text,
  ADD COLUMN IF NOT EXISTS bounce_subtype text,
  ADD COLUMN IF NOT EXISTS complaint_at timestamptz;

ALTER TABLE public.workspace_email_campaigns
  ADD COLUMN IF NOT EXISTS delivered_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS open_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS click_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS bounce_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS complaint_count integer NOT NULL DEFAULT 0;

-- ---------------------------------------------------------------------------
-- Denormalized engagement on circulation recipients + sends
-- ---------------------------------------------------------------------------
ALTER TABLE public.commercial_circulation_recipients
  ADD COLUMN IF NOT EXISTS delivered_at timestamptz,
  ADD COLUMN IF NOT EXISTS opened_at timestamptz,
  ADD COLUMN IF NOT EXISTS open_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS clicked_at timestamptz,
  ADD COLUMN IF NOT EXISTS click_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS bounced_at timestamptz,
  ADD COLUMN IF NOT EXISTS bounce_type text,
  ADD COLUMN IF NOT EXISTS bounce_subtype text,
  ADD COLUMN IF NOT EXISTS complaint_at timestamptz;

ALTER TABLE public.commercial_circulation_sends
  ADD COLUMN IF NOT EXISTS delivered_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS open_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS click_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS bounce_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS complaint_count integer NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.workspace_email_campaigns.delivered_count IS
  'Distinct recipients with a delivery event (denormalized from workspace_email_events).';
COMMENT ON COLUMN public.commercial_circulation_sends.delivered_count IS
  'Distinct recipients with a delivery event for this circulation send.';
