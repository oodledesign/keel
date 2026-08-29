-- Finish commercial circulation: SES ids, send metadata, auto-mailout flag,
-- and UPDATE on send rows (recipient_count was unwritable under RLS).

ALTER TABLE public.commercial_circulation_recipients
  ADD COLUMN IF NOT EXISTS ses_message_id text;

COMMENT ON COLUMN public.commercial_circulation_recipients.ses_message_id IS
  'Amazon SES MessageId when status is sent.';

CREATE INDEX IF NOT EXISTS commercial_circulation_recipients_account_email_idx
  ON public.commercial_circulation_recipients (account_id, email);

ALTER TABLE public.commercial_circulation_sends
  ADD COLUMN IF NOT EXISTS send_trigger text NOT NULL DEFAULT 'manual';

ALTER TABLE public.commercial_circulation_sends
  DROP CONSTRAINT IF EXISTS commercial_circulation_sends_send_trigger_check;

ALTER TABLE public.commercial_circulation_sends
  ADD CONSTRAINT commercial_circulation_sends_send_trigger_check
  CHECK (send_trigger IN ('manual', 'auto', 'dry_run'));

ALTER TABLE public.commercial_circulation_sends
  ADD COLUMN IF NOT EXISTS from_email text;

ALTER TABLE public.commercial_circulation_sends
  ADD COLUMN IF NOT EXISTS from_name text;

ALTER TABLE public.commercial_circulation_sends
  ADD COLUMN IF NOT EXISTS reply_to text;

COMMENT ON COLUMN public.commercial_circulation_sends.send_trigger IS
  'How this circulation was started: manual UI, auto new-match cron, or dry-run.';

GRANT UPDATE (recipient_count) ON public.commercial_circulation_sends TO authenticated;

DROP POLICY IF EXISTS commercial_circulation_sends_update
  ON public.commercial_circulation_sends;
CREATE POLICY commercial_circulation_sends_update
  ON public.commercial_circulation_sends
  FOR UPDATE TO authenticated
  USING (public.has_role_on_account(account_id))
  WITH CHECK (public.has_role_on_account(account_id));

ALTER TABLE public.commercial_listings
  ADD COLUMN IF NOT EXISTS auto_circulate_matches boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.commercial_listings.auto_circulate_matches IS
  'When true, subscribed matching applicants are mailed via SES as new fits appear.';

CREATE INDEX IF NOT EXISTS commercial_listings_auto_circulate_idx
  ON public.commercial_listings (account_id)
  WHERE auto_circulate_matches = true;
