-- Legacy CRM websites.business_id → businesses(id). Keel stores MakerKit workspace ids (accounts.id).
-- Remap rows, drop businesses FK, point business_id at public.accounts for RLS (has_role_on_account).

DO $$
DECLARE
  con record;
  websites_fk_businesses boolean;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'websites'
  ) THEN
    RETURN;
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class ref ON ref.oid = c.confrelid
    WHERE c.conrelid = 'public.websites'::regclass
      AND c.contype = 'f'
      AND ref.relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
      AND ref.relname = 'businesses'
  ) INTO websites_fk_businesses;

  IF NOT websites_fk_businesses THEN
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'businesses'
  ) THEN
    RAISE NOTICE 'repair_websites_business_fk_to_accounts: public.businesses missing; skipped.';
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'businesses'
      AND column_name = 'account_id'
  ) THEN
    RAISE NOTICE 'repair_websites_business_fk_to_accounts: businesses.account_id missing. Apply workspace migrations first.';
    RETURN;
  END IF;

  UPDATE public.websites w
  SET business_id = b.account_id
  FROM public.businesses b
  WHERE w.business_id = b.id
    AND b.account_id IS NOT NULL;

  IF EXISTS (
    SELECT 1
    FROM public.websites w
    INNER JOIN public.businesses b ON b.id = w.business_id
    WHERE b.account_id IS NULL
  ) THEN
    RAISE EXCEPTION
      'repair_websites_business_fk_to_accounts: businesses.account_id is NULL for a business that still owns website rows. Backfill businesses.account_id, then re-run.'
      USING HINT = 'Example: UPDATE public.businesses SET account_id = ''<accounts.id>'' WHERE id = ''<businesses.id>'';';
  END IF;

  DELETE FROM public.websites w
  WHERE NOT EXISTS (SELECT 1 FROM public.accounts a WHERE a.id = w.business_id)
    AND NOT EXISTS (
      SELECT 1 FROM public.businesses b WHERE b.id = w.business_id
    );

  FOR con IN
    SELECT c.conname
    FROM pg_constraint c
    JOIN pg_class ref ON ref.oid = c.confrelid
    WHERE c.conrelid = 'public.websites'::regclass
      AND c.contype = 'f'
      AND ref.relname = 'businesses'
  LOOP
    EXECUTE format('ALTER TABLE public.websites DROP CONSTRAINT %I', con.conname);
  END LOOP;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class ref ON ref.oid = c.confrelid
    WHERE c.conrelid = 'public.websites'::regclass
      AND c.contype = 'f'
      AND ref.relname = 'accounts'
  ) THEN
    ALTER TABLE public.websites
      ADD CONSTRAINT websites_business_id_fkey
      FOREIGN KEY (business_id) REFERENCES public.accounts(id) ON DELETE CASCADE;
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
