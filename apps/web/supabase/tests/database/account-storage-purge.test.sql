begin;
create extension if not exists "basejump-supabase_test_helpers" version '0.0.6';

select no_plan();

select tests.create_supabase_user('purge_owner', 'purge-owner@test.com');

set local role service_role;

select public.create_team_account(
  'Purge Queue Test',
  tests.get_supabase_uid('purge_owner'),
  'purge-queue-test'
);

delete from public.accounts
where slug = 'purge-queue-test';

select isnt_empty(
  $$ select 1 from public.account_storage_purges where status = 'pending' $$,
  'Deleting an account enqueues a 30-day storage purge'
);

select is(
  (select owner_email from public.account_storage_purges limit 1),
  'purge-owner@test.com',
  'Purge queue snapshots owner email for deletion notices'
);

select *
from finish();

rollback;
