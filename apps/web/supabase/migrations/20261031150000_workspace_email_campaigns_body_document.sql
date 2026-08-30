-- Persist the Campaigns block-builder document alongside compiled html_body.
-- Do not reuse or alter public.email_campaigns (admin marketing).

ALTER TABLE public.workspace_email_campaigns
  ADD COLUMN IF NOT EXISTS body_document jsonb;

COMMENT ON COLUMN public.workspace_email_campaigns.body_document IS
  'Stacked email block document (versioned JSON). html_body is the compiled email-safe HTML used at send time.';
