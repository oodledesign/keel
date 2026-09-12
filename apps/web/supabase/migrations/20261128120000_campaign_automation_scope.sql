-- Welcome automations: optional per-form / per-audience-list scope.
-- Both columns null = current workspace-wide new_subscriber behaviour.

ALTER TABLE public.campaign_automations
  ADD COLUMN IF NOT EXISTS form_id uuid
    REFERENCES public.workspace_forms (id) ON DELETE SET NULL;

ALTER TABLE public.campaign_automations
  ADD COLUMN IF NOT EXISTS audience_list_id uuid
    REFERENCES public.campaign_audience_lists (id) ON DELETE SET NULL;

COMMENT ON COLUMN public.campaign_automations.form_id IS
  'Optional welcome scope. Null = any mailing-list signup. Set = fire when this form is the signup source.';

COMMENT ON COLUMN public.campaign_automations.audience_list_id IS
  'Optional welcome scope. Null = any list. Set = fire when signup is attributed to this audience list.';

CREATE INDEX IF NOT EXISTS ix_campaign_automations_form
  ON public.campaign_automations (account_id, form_id)
  WHERE form_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS ix_campaign_automations_audience_list
  ON public.campaign_automations (account_id, audience_list_id)
  WHERE audience_list_id IS NOT NULL;

-- Mailing-list forms can land subscribers on a Campaigns audience list.
ALTER TABLE public.workspace_forms
  ADD COLUMN IF NOT EXISTS audience_list_id uuid
    REFERENCES public.campaign_audience_lists (id) ON DELETE SET NULL;

COMMENT ON COLUMN public.workspace_forms.audience_list_id IS
  'Optional Campaigns audience list for mailing_list forms. Signup adds a member (manual lists) and attributes welcome automations.';

CREATE INDEX IF NOT EXISTS ix_workspace_forms_audience_list
  ON public.workspace_forms (account_id, audience_list_id)
  WHERE audience_list_id IS NOT NULL;

NOTIFY pgrst, 'reload schema';
