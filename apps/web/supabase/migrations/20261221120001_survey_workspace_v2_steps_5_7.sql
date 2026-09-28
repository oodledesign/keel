-- Survey Workspace v2 steps 5–7: phrase/publish/pipeline + contracts for
-- building-surveyor. Additive only (IF NOT EXISTS / ON CONFLICT).

ALTER TABLE public.pipeline_deals
  ADD COLUMN IF NOT EXISTS follow_up_call boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.pipeline_deals.follow_up_call IS
  'Surveyor pipeline: follow-up call is a card flag, not a stage.';

CREATE OR REPLACE FUNCTION public.seed_account_module_settings(
  p_account_id uuid,
  p_space_type text DEFAULT 'work',
  p_business_type text DEFAULT 'other'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  normalized_space text;
  normalized_biz text;
  keys text[];
  k text;
BEGIN
  normalized_space := lower(coalesce(p_space_type, 'work'));
  normalized_biz := lower(coalesce(p_business_type, 'other'));

  IF normalized_space = 'family' THEN
    keys := ARRAY[
      'dashboard', 'tasks', 'jobs', 'calendar', 'meal_plan', 'shopping',
      'notes', 'members', 'settings'
    ];
  ELSIF normalized_space = 'community' THEN
    keys := ARRAY[
      'dashboard', 'schedule', 'tasks', 'notes', 'members', 'settings'
    ];
  ELSIF normalized_space = 'commercial-property' THEN
    keys := ARRAY[
      'dashboard', 'listings', 'pipeline', 'forms', 'clients', 'properties',
      'requirements', 'viewings', 'proposals', 'leases', 'reports', 'docs',
      'tasks', 'notes', 'sops', 'team', 'settings'
    ];
  ELSIF normalized_space = 'building-surveyor' THEN
    keys := ARRAY[
      'dashboard', 'pipeline', 'forms', 'clients', 'meetings', 'surveys',
      'proposals', 'contracts', 'invoices', 'notes', 'docs', 'tasks', 'team',
      'settings'
    ];
  ELSIF normalized_space = 'property' OR normalized_biz = 'property' THEN
    keys := ARRAY[
      'dashboard', 'properties', 'clients', 'jobs', 'finances',
      'docs', 'tasks', 'notes', 'team', 'settings'
    ];
  ELSIF normalized_biz = 'lite' THEN
    keys := ARRAY['dashboard', 'apps', 'settings', 'team'];
  ELSE
    keys := ARRAY[
      'dashboard', 'jobs', 'tasks', 'schedule', 'pipeline', 'forms', 'clients',
      'websites', 'support_tickets', 'client_portal', 'invoices', 'team',
      'notes', 'docs', 'sops', 'messages', 'finances', 'settings'
    ];
  END IF;

  FOREACH k IN ARRAY keys
  LOOP
    INSERT INTO public.account_module_settings (account_id, module_key, enabled)
    VALUES (p_account_id, k, true)
    ON CONFLICT (account_id, module_key) DO NOTHING;
  END LOOP;
END;
$$;

INSERT INTO public.account_module_settings (account_id, module_key, enabled)
SELECT a.id, k.module_key, true
FROM public.accounts a
CROSS JOIN (
  SELECT unnest(ARRAY[
    'forms',
    'contracts',
    'invoices'
  ]) AS module_key
) k
WHERE a.is_personal_account = false
  AND a.space_type = 'building-surveyor'
ON CONFLICT (account_id, module_key) DO NOTHING;

NOTIFY pgrst, 'reload schema';
