-- Personal default landing can target a specific workspace page (shortcut catalog).
-- Mailing-list forms can target one or more Campaigns audience lists.

ALTER TABLE public.user_settings
  ADD COLUMN IF NOT EXISTS default_landing_catalog_id text,
  ADD COLUMN IF NOT EXISTS default_landing_params jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.user_settings.default_landing_catalog_id IS
  'Optional shortcut catalog id for a workspace page when default_landing_type = workspace.';
COMMENT ON COLUMN public.user_settings.default_landing_params IS
  'Shortcut params (usually { href }) used with default_landing_catalog_id.';

ALTER TABLE public.workspace_forms
  ADD COLUMN IF NOT EXISTS audience_list_ids uuid[] NOT NULL DEFAULT '{}';

COMMENT ON COLUMN public.workspace_forms.audience_list_ids IS
  'Campaigns audience lists targeted by a mailing_list form. One list auto-joins; several can be offered to the subscriber.';

UPDATE public.workspace_forms
SET audience_list_ids = ARRAY[audience_list_id]
WHERE audience_list_id IS NOT NULL
  AND cardinality(audience_list_ids) = 0;

CREATE INDEX IF NOT EXISTS ix_workspace_forms_audience_list_ids
  ON public.workspace_forms USING gin (audience_list_ids);

NOTIFY pgrst, 'reload schema';
