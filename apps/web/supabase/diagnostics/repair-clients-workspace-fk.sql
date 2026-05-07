-- Manual repair when clients.account_id still references businesses(id) and the app
-- sends public.accounts.id (FK error 23503).
--
-- 1) Inspect foreign keys on public.clients
SELECT c.conname,
       pg_get_constraintdef(c.oid) AS def
FROM pg_constraint c
WHERE c.conrelid = 'public.clients'::regclass
  AND c.contype = 'f';

-- 2) List businesses missing a workspace link (must fix before repointing clients)
SELECT b.id AS business_id,
       b.name,
       b.account_id AS workspace_account_id
FROM public.businesses b
WHERE b.account_id IS NULL;

-- 3) Set each business’s workspace (replace UUIDs with your team account id + business id)
-- UPDATE public.businesses
-- SET account_id = '00000000-0000-0000-0000-000000000000'::uuid
-- WHERE id = '00000000-0000-0000-0000-000000000000'::uuid;

-- 4) Apply migrations from apps/web (preferred)
--    pnpm exec supabase db push
-- Migrations: 20260504100000, 20260504110000 (stronger FK detection)
