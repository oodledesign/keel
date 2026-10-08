-- Business Free includes Messages (the plan card promises unlimited
-- messaging). New Free workspaces get it from the seed, and existing Free
-- workspaces have it switched on. Their Messages rows were written disabled
-- by plan sync, never by an owner toggle (no settings UI offers one).

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
      'pipeline', 'messages'
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

-- Free = business type 'lite', or a Free entitlement with no paid Business one.
INSERT INTO public.account_module_settings (account_id, module_key, enabled)
SELECT a.id, 'messages', true
FROM public.accounts a
WHERE a.is_personal_account = false
  AND coalesce(a.space_type, 'work') = 'work'
  AND (
    EXISTS (
      SELECT 1
      FROM public.businesses b
      WHERE b.account_id = a.id
        AND lower(coalesce(b.type, '')) = 'lite'
    )
    OR (
      EXISTS (
        SELECT 1
        FROM public.account_entitlements e
        WHERE e.account_id = a.id
          AND e.entitlement_key = 'workspace_business_lite'
          AND (e.expires_at IS NULL OR e.expires_at > now())
      )
      AND NOT EXISTS (
        SELECT 1
        FROM public.account_entitlements e
        WHERE e.account_id = a.id
          AND e.entitlement_key IN (
            'workspace_business',
            'workspace_business_starter'
          )
          AND (e.expires_at IS NULL OR e.expires_at > now())
      )
    )
  )
ON CONFLICT (account_id, module_key) DO UPDATE
SET enabled = true;
