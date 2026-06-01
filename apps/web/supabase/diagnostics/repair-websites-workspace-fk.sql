-- Manual repair when websites.business_id still references businesses(id).
-- Run in Supabase SQL editor, then NOTIFY pgrst, 'reload schema';

-- 1) Ensure each business row has account_id (team workspace id)
-- SELECT id, account_id, name FROM public.businesses WHERE account_id IS NULL;

-- 2) Apply migration 20260601100000_repair_websites_business_fk_to_accounts.sql via:
--    cd apps/web && pnpm exec supabase db push
