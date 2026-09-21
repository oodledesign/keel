BEGIN;
create extension if not exists "basejump-supabase_test_helpers" version '0.0.6';

select no_plan();

select has_table('public', 'retainer_service_categories');
select tests.rls_enabled('public', 'retainer_service_categories');
select has_column('public', 'retainer_services', 'is_visible');
select has_column('public', 'retainer_services', 'category_id');
select has_column('public', 'client_retainer_services', 'is_visible');
select has_column('public', 'project_retainer_services', 'is_visible');

DO $$
DECLARE
  v_account_id uuid;
  v_category_id uuid;
  v_service_id uuid;
BEGIN
  INSERT INTO public.accounts (id, name, slug, is_personal_account)
  VALUES (
    gen_random_uuid(),
    'Visibility Test',
    'retainer-visibility-' || substr(gen_random_uuid()::text, 1, 8),
    false
  )
  RETURNING id INTO v_account_id;

  INSERT INTO public.retainer_service_categories (account_id, name, sort_order)
  VALUES (v_account_id, 'Web', 0)
  RETURNING id INTO v_category_id;

  INSERT INTO public.retainer_services (
    account_id, name, credit_cost, scope, category_id, is_visible
  ) VALUES (
    v_account_id, 'Website update', 2, 'workspace', v_category_id, true
  )
  RETURNING id INTO v_service_id;

  IF (
    SELECT is_visible FROM public.retainer_services WHERE id = v_service_id
  ) IS NOT TRUE THEN
    RAISE EXCEPTION 'new services default visible';
  END IF;

  DELETE FROM public.retainer_service_categories WHERE id = v_category_id;

  IF (
    SELECT category_id FROM public.retainer_services WHERE id = v_service_id
  ) IS NOT NULL THEN
    RAISE EXCEPTION 'deleting a category should uncategorize services';
  END IF;
END $$;

select * from finish();
ROLLBACK;
