BEGIN;
create extension if not exists "basejump-supabase_test_helpers" version '0.0.6';

select no_plan();

select has_table('public', 'retainer_services');
select has_table('public', 'project_retainers');
select has_table('public', 'project_retainer_services');
select has_table('public', 'project_retainer_transactions');
select has_table('public', 'retainer_match_suggestions');
select has_table('public', 'project_retainer_digest_log');

select tests.rls_enabled('public', 'retainer_services');
select tests.rls_enabled('public', 'project_retainers');
select tests.rls_enabled('public', 'project_retainer_transactions');

select has_function('public', 'ensure_project_retainer');
select has_function('public', 'adjust_project_retainer_credits');
select has_function('public', 'consume_project_retainer_credits');
select has_function('public', 'restore_project_retainer_credits');

DO $$
DECLARE
  v_account_id uuid;
  v_project_id uuid;
  v_task_id uuid;
  v_grant jsonb;
  v_consume jsonb;
  v_insuf jsonb;
  v_undo jsonb;
  v_balance integer;
BEGIN
  INSERT INTO public.accounts (id, name, slug, is_personal_account)
  VALUES (
    gen_random_uuid(),
    'Retainer Test',
    'retainer-test-' || substr(gen_random_uuid()::text, 1, 8),
    false
  )
  RETURNING id INTO v_account_id;

  INSERT INTO public.projects (id, account_id, name)
  VALUES (gen_random_uuid(), v_account_id, 'Retainer Project')
  RETURNING id INTO v_project_id;

  v_grant := public.adjust_project_retainer_credits(
    v_project_id,
    v_account_id,
    5,
    NULL,
    'seed'
  );

  IF coalesce((v_grant->>'ok')::boolean, false) IS NOT TRUE THEN
    RAISE EXCEPTION 'grant failed: %', v_grant;
  END IF;

  SELECT credit_balance INTO v_balance
  FROM public.project_retainers
  WHERE project_id = v_project_id;

  IF v_balance <> 5 THEN
    RAISE EXCEPTION 'expected balance 5, got %', v_balance;
  END IF;

  INSERT INTO public.tasks (id, title, account_id, project_id, status, priority)
  VALUES (gen_random_uuid(), 'Burn task', v_account_id, v_project_id, 'todo', 'medium')
  RETURNING id INTO v_task_id;

  v_consume := public.consume_project_retainer_credits(
    v_project_id,
    v_account_id,
    2,
    NULL,
    v_task_id,
    NULL,
    NULL,
    'test_burn'
  );

  IF coalesce((v_consume->>'ok')::boolean, false) IS NOT TRUE THEN
    RAISE EXCEPTION 'consume failed: %', v_consume;
  END IF;

  v_insuf := public.consume_project_retainer_credits(
    v_project_id,
    v_account_id,
    10,
    NULL,
    NULL,
    NULL,
    NULL,
    'too_much'
  );

  IF coalesce(v_insuf->>'error', '') <> 'insufficient_balance' THEN
    RAISE EXCEPTION 'expected insufficient_balance, got %', v_insuf;
  END IF;

  v_undo := public.restore_project_retainer_credits(v_task_id, NULL, 'undo');

  IF coalesce((v_undo->>'ok')::boolean, false) IS NOT TRUE THEN
    RAISE EXCEPTION 'undo failed: %', v_undo;
  END IF;

  SELECT credit_balance INTO v_balance
  FROM public.project_retainers
  WHERE project_id = v_project_id;

  IF v_balance <> 5 THEN
    RAISE EXCEPTION 'expected restored balance 5, got %', v_balance;
  END IF;
END $$;

select * from finish();
ROLLBACK;
