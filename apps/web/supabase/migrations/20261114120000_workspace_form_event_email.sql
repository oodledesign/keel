-- RSVP event meta + per-form email automation (autoresponders / notifications).
-- Additive: existing forms keep their fields and submissions. Field types live in
-- workspace_forms.fields jsonb (no enum), so yes_no / date / radio / file need no
-- column change.

ALTER TABLE public.workspace_forms
  ADD COLUMN IF NOT EXISTS event_address text;

ALTER TABLE public.workspace_forms
  ADD COLUMN IF NOT EXISTS email_settings jsonb NOT NULL DEFAULT '{}'::jsonb;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'workspace_forms_email_settings_is_object'
      AND conrelid = 'public.workspace_forms'::regclass
  ) THEN
    ALTER TABLE public.workspace_forms
      ADD CONSTRAINT workspace_forms_email_settings_is_object
      CHECK (jsonb_typeof(email_settings) = 'object');
  END IF;
END
$$;

COMMENT ON COLUMN public.workspace_forms.event_address IS
  'Optional event venue shown on the public RSVP page (form meta, not a submitter question).';

COMMENT ON COLUMN public.workspace_forms.email_settings IS
  'JSON object: templates[], rules[] (autoresponder | notification), notifyMemberIds[], notifyEmails[] (max 10).';

NOTIFY pgrst, 'reload schema';
