-- Campaign audience v1: source type + per-campaign config (custom emails / client ids / contact ids).
-- Saved named audience lists + filter builder are follow-up work.

ALTER TABLE public.workspace_email_campaigns
  ADD COLUMN IF NOT EXISTS audience_type text NOT NULL DEFAULT 'subscribers',
  ADD COLUMN IF NOT EXISTS audience_config jsonb NOT NULL DEFAULT '{}'::jsonb;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'workspace_email_campaigns_audience_type_check'
  ) THEN
    ALTER TABLE public.workspace_email_campaigns
      ADD CONSTRAINT workspace_email_campaigns_audience_type_check
      CHECK (
        audience_type IN ('subscribers', 'clients', 'contacts', 'custom')
      );
  END IF;
END $$;

COMMENT ON COLUMN public.workspace_email_campaigns.audience_type IS
  'Audience source: subscribers (mailing list), clients, contacts, or custom mix.';

COMMENT ON COLUMN public.workspace_email_campaigns.audience_config IS
  'JSON config for audience. For custom: { emails: string[], clientIds: uuid[], contactIds: uuid[] }.';
