BEGIN;
create extension if not exists "basejump-supabase_test_helpers" version '0.0.6';

select no_plan();

select has_table('public', 'client_retainer_services');
select tests.rls_enabled('public', 'client_retainer_services');
select has_column('public', 'retainer_services', 'scope');
select has_column('public', 'clients', 'retainer_services_source');
select has_column('public', 'project_retainers', 'services_source');
select has_column('public', 'project_retainer_services', 'credit_cost');
select has_column('public', 'support_tickets', 'retainer_service_id');

DO $$
DECLARE
  v_account_id uuid;
  v_client_id uuid;
  v_project_id uuid;
  v_workspace_id uuid;
  v_allow_id uuid;
BEGIN
  INSERT INTO public.accounts (id, name, slug, is_personal_account)
  VALUES (
    gen_random_uuid(),
    'Personalization Test',
    'retainer-personalization-' || substr(gen_random_uuid()::text, 1, 8),
    false
  )
  RETURNING id INTO v_account_id;

  INSERT INTO public.clients (id, account_id, display_name)
  VALUES (gen_random_uuid(), v_account_id, 'Mick')
  RETURNING id INTO v_client_id;

  INSERT INTO public.projects (id, account_id, client_id, name)
  VALUES (gen_random_uuid(), v_account_id, v_client_id, 'Community app')
  RETURNING id INTO v_project_id;

  INSERT INTO public.retainer_services (account_id, name, credit_cost, scope)
  VALUES (v_account_id, 'Website update', 2, 'workspace')
  RETURNING id INTO v_workspace_id;

  PERFORM public.ensure_project_retainer(v_project_id, v_account_id);

  INSERT INTO public.project_retainer_services (project_id, service_id)
  VALUES (v_project_id, v_workspace_id)
  RETURNING service_id INTO v_allow_id;

  IF v_allow_id IS NULL THEN
    RAISE EXCEPTION 'expected allowlist insert';
  END IF;

  -- Backfill should mark existing allowlists as project overrides.
  UPDATE public.project_retainers
  SET services_source = 'inherited'
  WHERE project_id = v_project_id;

  UPDATE public.project_retainers pr
  SET services_source = 'custom'
  WHERE pr.project_id = v_project_id
    AND EXISTS (
      SELECT 1
      FROM public.project_retainer_services prs
      WHERE prs.project_id = pr.project_id
    );

  IF (
    SELECT services_source
    FROM public.project_retainers
    WHERE project_id = v_project_id
  ) <> 'custom' THEN
    RAISE EXCEPTION 'expected existing allowlist to stay a project override';
  END IF;

  INSERT INTO public.client_retainer_services (
    client_id, service_id, name, credit_cost
  ) VALUES (
    v_client_id, v_workspace_id, 'Webflow tweak', 3
  );

  UPDATE public.clients
  SET retainer_services_source = 'custom'
  WHERE id = v_client_id;

  IF NOT EXISTS (
    SELECT 1
    FROM public.client_retainer_services
    WHERE client_id = v_client_id
      AND credit_cost = 3
  ) THEN
    RAISE EXCEPTION 'expected client override row';
  END IF;

  -- Workspace-scope custom row must stay workspace-shaped.
  BEGIN
    INSERT INTO public.retainer_services (
      account_id, name, credit_cost, scope, client_id
    ) VALUES (
      v_account_id, 'Bad shape', 1, 'workspace', v_client_id
    );
    RAISE EXCEPTION 'expected scope shape check';
  EXCEPTION
    WHEN check_violation THEN
      NULL;
  END;
END $$;

select * from finish();
ROLLBACK;
