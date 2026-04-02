-- Run this in Supabase SQL Editor to debug why the app sees no teams (e.g. on /home/clients).
-- The app loads teams from the view public.user_accounts; if that returns no rows, you see "Create or join a team".
--
-- If you get: relation "public.accounts" does not exist
-- → Your database has not had the full migration history applied. The "accounts" table is created in
--   the base schema migration (20221215192558_schema.sql). You must run all migrations in order:
--   From repo root:  pnpm --filter web supabase db push   (or: supabase db push from apps/web)
--   Or in Supabase Dashboard: run the SQL from each migration file in timestamp order.
--
-- App checklist:
-- - Env: NEXT_PUBLIC_ENABLE_TEAM_ACCOUNTS must be true (default).
-- - Server logs: if loadUserAccounts fails, you'll see "[loadUserWorkspace] loadUserAccounts failed: ..." in the terminal.
--
-- 0) Check that base schema exists (run this first; if it errors, apply migrations as above)
SELECT 1 FROM public.accounts LIMIT 1;

-- 1) List all team accounts (non-personal) and their slugs
SELECT id, name, slug, is_personal_account, primary_owner_user_id
FROM public.accounts
WHERE is_personal_account = false
ORDER BY name;

-- 2) List all memberships: which users are in which accounts
-- Your user id: Supabase Dashboard -> Authentication -> Users
SELECT am.user_id, am.account_id, am.account_role, a.name AS account_name, a.slug, a.is_personal_account
FROM public.accounts_memberships am
JOIN public.accounts a ON a.id = am.account_id
ORDER BY a.name, am.user_id;

-- 3) Check if user_accounts view exists (if this errors, the view is missing)
SELECT pg_get_viewdef('public.user_accounts'::regclass, true);

-- 4) App config in DB (team accounts must be enabled)
SELECT key, value FROM public.config WHERE key = 'enable_team_accounts';

-- 5) Simulate what user_accounts returns for a specific user (SQL Editor runs as postgres, so auth.uid() is null)
-- Replace the user_id with your Auth user id from Dashboard -> Authentication -> Users
SELECT account.id, account.name, account.slug, membership.account_role
FROM public.accounts account
JOIN public.accounts_memberships membership ON account.id = membership.account_id
WHERE membership.user_id = 'REPLACE_WITH_YOUR_USER_ID'
  AND account.is_personal_account = false;
