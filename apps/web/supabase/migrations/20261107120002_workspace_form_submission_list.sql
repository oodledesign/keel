-- Workspace form destination: submission_list (store responses only; no CRM side effects).

ALTER TABLE public.workspace_forms
  DROP CONSTRAINT IF EXISTS workspace_forms_destination_check;

ALTER TABLE public.workspace_forms
  ADD CONSTRAINT workspace_forms_destination_check
  CHECK (destination IN (
    'pipeline',
    'listing_enquiry',
    'mailing_list',
    'submission_list'
  ));

COMMENT ON COLUMN public.workspace_forms.destination IS
  'pipeline = pipeline_deals lead; listing_enquiry = commercial_enquiries; mailing_list = upsert clients + workspace_mailing_preferences; submission_list = store workspace_form_submissions only.';

NOTIFY pgrst, 'reload schema';
