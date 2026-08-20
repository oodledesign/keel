-- Per-user email notification preferences (JSONB). Empty object = use product defaults.
-- Existing user_settings RLS (own row) covers access.

ALTER TABLE public.user_settings
  ADD COLUMN IF NOT EXISTS email_notification_preferences jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.user_settings
  DROP CONSTRAINT IF EXISTS user_settings_email_notification_preferences_object;

ALTER TABLE public.user_settings
  ADD CONSTRAINT user_settings_email_notification_preferences_object
  CHECK (jsonb_typeof(email_notification_preferences) = 'object');

COMMENT ON COLUMN public.user_settings.email_notification_preferences IS
  'Optional email notification toggles keyed by type, e.g. commercial_match_digest. Missing keys use product defaults (usually on).';
