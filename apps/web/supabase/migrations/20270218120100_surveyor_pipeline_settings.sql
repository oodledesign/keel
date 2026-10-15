-- Building-surveyor pipeline thresholds on the existing workspace survey
-- defaults row. Additive only; other workspaces never read these columns.
--   * lead_amber_days / lead_red_days: traffic-light idle thresholds.
--   * lead_archive_days: idle days before the archive prompt lists a lead.
--   * quote_reminder_days: days in "Quote sent" before the daily reminder.
--   * quote_reminder_client_email: also email the client a gentle reminder.

ALTER TABLE public.survey_account_settings
  ADD COLUMN IF NOT EXISTS lead_amber_days integer NOT NULL DEFAULT 7,
  ADD COLUMN IF NOT EXISTS lead_red_days integer NOT NULL DEFAULT 14,
  ADD COLUMN IF NOT EXISTS lead_archive_days integer NOT NULL DEFAULT 30,
  ADD COLUMN IF NOT EXISTS quote_reminder_days integer NOT NULL DEFAULT 3,
  ADD COLUMN IF NOT EXISTS quote_reminder_client_email boolean NOT NULL DEFAULT false;

ALTER TABLE public.survey_account_settings
  DROP CONSTRAINT IF EXISTS survey_account_settings_lead_days_check;
ALTER TABLE public.survey_account_settings
  ADD CONSTRAINT survey_account_settings_lead_days_check
  CHECK (
    lead_amber_days >= 1
    AND lead_red_days >= lead_amber_days
    AND lead_archive_days >= 1
    AND quote_reminder_days >= 1
  );

COMMENT ON COLUMN public.survey_account_settings.lead_amber_days IS
  'Days without activity before a lead shows amber.';
COMMENT ON COLUMN public.survey_account_settings.lead_red_days IS
  'Days without activity before a lead shows red. Never below amber.';
COMMENT ON COLUMN public.survey_account_settings.lead_archive_days IS
  'Days without activity before a lead is offered for archiving as lost.';
COMMENT ON COLUMN public.survey_account_settings.quote_reminder_days IS
  'Days a lead can sit in Quote sent before the surveyor is reminded.';
COMMENT ON COLUMN public.survey_account_settings.quote_reminder_client_email IS
  'When true the quote reminder also emails the client.';

NOTIFY pgrst, 'reload schema';
