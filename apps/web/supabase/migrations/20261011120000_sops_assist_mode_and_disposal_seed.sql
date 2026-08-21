-- Guided SOPs: assist targeting columns + commercial disposal seed playbook.

alter table sops.playbook_steps
  add column if not exists target_selector text,
  add column if not exists target_route text;

alter table sops.runs
  add column if not exists assist_mode boolean not null default false;

comment on column sops.playbook_steps.target_selector is
  'Optional CSS selector for driver.js Assist mode (e.g. [data-tour="..."]).';

comment on column sops.playbook_steps.target_route is
  'Optional path template for Assist mode navigation; may include [account].';

comment on column sops.runs.assist_mode is
  'True when the run was started via Assist me (tracker widget + guided tour).';

-- Enable SOPs module for commercial-property workspaces (seed + backfill).
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
      'dashboard', 'listings', 'pipeline', 'clients', 'requirements',
      'viewings', 'proposals', 'leases', 'reports', 'docs', 'tasks',
      'notes', 'sops', 'team', 'settings'
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
      'dashboard', 'jobs', 'tasks', 'schedule', 'pipeline', 'clients',
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
SELECT a.id, 'sops', true
FROM public.accounts a
WHERE a.is_personal_account = false
  AND a.space_type = 'commercial-property'
ON CONFLICT (account_id, module_key) DO NOTHING;

-- Seed "Adding a Disposal" playbook for each commercial-property account (idempotent).
DO $$
DECLARE
  acc record;
  playbook_id uuid;
BEGIN
  FOR acc IN
    SELECT id
    FROM public.accounts
    WHERE is_personal_account = false
      AND space_type = 'commercial-property'
  LOOP
    SELECT p.id INTO playbook_id
    FROM sops.playbooks p
    WHERE p.account_id = acc.id
      AND p.title = 'Adding a Disposal'
    LIMIT 1;

    IF playbook_id IS NOT NULL THEN
      CONTINUE;
    END IF;

    INSERT INTO sops.playbooks (
      account_id,
      title,
      description,
      category,
      recurrence
    )
    VALUES (
      acc.id,
      'Adding a Disposal',
      'Guided process for creating a commercial disposal and getting it live on the portals.',
      'Disposals',
      'ad_hoc'
    )
    RETURNING id INTO playbook_id;

    INSERT INTO sops.playbook_steps (
      playbook_id,
      position,
      title,
      body_md,
      target_selector,
      target_route
    )
    VALUES
      (
        playbook_id,
        0,
        'Start the disposal record',
        'Open Disposals and add a new disposal. Enter the name, address, asking rent or price, size (sq ft), and use class before saving.',
        '[data-tour="sop-add-disposal"]',
        '/app/[account]/listings?create=1'
      ),
      (
        playbook_id,
        1,
        'Add photos and floor plans',
        'On the disposal Media tab, upload photos and floor plans so marketing and portals have visuals to show.',
        '[data-tour="sop-listing-media"]',
        '/app/[account]/listings'
      ),
      (
        playbook_id,
        2,
        'Attach EPC certificate or rating',
        'Add the EPC band/rating on the disposal, or upload the EPC certificate on the Media tab.',
        '[data-tour="sop-listing-epc"]',
        '/app/[account]/listings'
      ),
      (
        playbook_id,
        3,
        'Write the marketing description',
        'On the Marketing tab, write the summary, key points, and full marketing description buyers and tenants will see.',
        '[data-tour="sop-listing-marketing"]',
        '/app/[account]/listings'
      ),
      (
        playbook_id,
        4,
        'Generate or attach the brochure',
        'Upload a brochure on Media, or open the brochure editor to generate a PDF brochure for the disposal.',
        '[data-tour="sop-listing-brochure"]',
        '/app/[account]/listings'
      ),
      (
        playbook_id,
        5,
        'Check listing details for portal publishing',
        'Open Management and review portal publishing settings so listing fields map correctly to the portal feeds.',
        '[data-tour="sop-listing-portal"]',
        '/app/[account]/listings'
      ),
      (
        playbook_id,
        6,
        'Publish to the portals and confirm it is live',
        'Publish to the connected portals from Management and confirm the disposal appears live on each feed.',
        '[data-tour="sop-listing-publish"]',
        '/app/[account]/listings'
      );
  END LOOP;
END;
$$;

notify pgrst, 'reload schema';
