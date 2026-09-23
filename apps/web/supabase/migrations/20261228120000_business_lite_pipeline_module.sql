-- Business Lite includes Pipeline, plus the capped CRM modules the app already
-- grants (clients, tasks, invoices, portal, notes). A later seed rewrite had
-- dropped those keys back to the apps shell. New Lite workspaces get the full
-- list. Existing Lite workspaces gain Pipeline, and any missing Lite modules
-- are inserted without turning a deliberately disabled row back on.

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
      'memories', 'notes', 'members', 'settings'
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
    keys := ARRAY[
      'dashboard', 'apps', 'settings', 'team',
      'clients', 'tasks', 'invoices', 'client_portal', 'notes',
      'pipeline'
    ];
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

  IF normalized_space = 'family' THEN
    PERFORM public.seed_family_memory_categories(p_account_id);
  END IF;
END;
$$;

INSERT INTO public.account_module_settings (account_id, module_key, enabled)
SELECT DISTINCT b.account_id, keys.module_key, true
FROM public.businesses b
CROSS JOIN (
  VALUES
    ('dashboard'),
    ('apps'),
    ('settings'),
    ('team'),
    ('clients'),
    ('tasks'),
    ('invoices'),
    ('client_portal'),
    ('notes')
) AS keys(module_key)
WHERE lower(coalesce(b.type, '')) = 'lite'
ON CONFLICT (account_id, module_key) DO NOTHING;

-- Pipeline was written disabled by plan sync before this change. Those rows
-- were not an owner toggle, so re-enable them for current Lite workspaces.
INSERT INTO public.account_module_settings (account_id, module_key, enabled)
SELECT DISTINCT b.account_id, 'pipeline', true
FROM public.businesses b
WHERE lower(coalesce(b.type, '')) = 'lite'
ON CONFLICT (account_id, module_key) DO UPDATE
SET enabled = true;
