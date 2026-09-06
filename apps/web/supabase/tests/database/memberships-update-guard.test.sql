begin;
create extension "basejump-supabase_test_helpers" version '0.0.6';

select no_plan();

select tests.create_supabase_user('guard_owner', 'guard-owner@test.com');
select tests.create_supabase_user('guard_other', 'guard-other@test.com');

set local role service_role;

select public.create_team_account(
  'Guard Team',
  tests.get_supabase_uid('guard_owner'),
  'guard-team',
  'work',
  'lite',
  true
);

select lives_ok(
  $$
    update public.accounts_memberships
    set onboarding_completed = true
    where user_id = tests.get_supabase_uid('guard_owner')
  $$,
  'Re-applying onboarding_completed = true must not raise'
);

select lives_ok(
  $$
    update public.accounts_memberships
    set onboarding_step = 2
    where user_id = tests.get_supabase_uid('guard_owner')
  $$,
  'Allowlisted onboarding_step updates still succeed'
);

select throws_ok(
  $$
    update public.accounts_memberships
    set user_id = tests.get_supabase_uid('guard_other')
    where user_id = tests.get_supabase_uid('guard_owner')
  $$,
  'Only account_role, company_role, trade_role, onboarding_step, onboarding_completed, and seat_kind can be updated',
  'Membership user_id cannot be reassigned'
);

select throws_ok(
  $$
    update public.accounts_memberships
    set created_by = tests.get_supabase_uid('guard_other')
    where user_id = tests.get_supabase_uid('guard_owner')
  $$,
  'Only account_role, company_role, trade_role, onboarding_step, onboarding_completed, and seat_kind can be updated',
  'Membership created_by cannot be changed'
);

select * from finish();

rollback;
