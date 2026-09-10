begin;

create extension if not exists "basejump-supabase_test_helpers" version '0.0.6';

select no_plan();

select has_table(
  'public',
  'project_statuses',
  'project_statuses table should exist'
);

select tests.rls_enabled('public', 'project_statuses');

select tests.create_supabase_user('status_owner', 'status-owner@test.com');

set local role service_role;

select public.create_team_account(
  'Status Workspace',
  tests.get_supabase_uid('status_owner'),
  'status-workspace'
);

set local role postgres;

select isnt_empty(
  $$
    select slug
    from public.project_statuses
    where account_id = makerkit.get_account_id_by_slug('status-workspace')
      and slug = 'pending'
  $$,
  'New team workspaces receive default project statuses'
);

select makerkit.authenticate_as('status_owner');

select lives_ok(
  $$
    insert into public.project_statuses (
      account_id, slug, label, color, sort_order, category
    ) values (
      makerkit.get_account_id_by_slug('status-workspace'),
      'invoiced',
      'Invoiced',
      '#41606F',
      10,
      'open'
    )
  $$,
  'Workspace admins can add custom statuses such as Invoiced'
);

select throws_ok(
  $$
    insert into public.project_statuses (
      account_id, slug, label, color, sort_order, category
    ) values (
      makerkit.get_account_id_by_slug('status-workspace'),
      '1bad',
      'Bad',
      '#41606F',
      11,
      'open'
    )
  $$,
  '23514',
  'Invalid slugs are rejected'
);

select * from finish();

rollback;
