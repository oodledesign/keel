-- Legacy/prod agency_branding.business_id → businesses(id).
-- App + RLS expect MakerKit workspace ids (accounts.id) and has_role_on_account(business_id).
-- Remap rows, drop businesses FK, point business_id at public.accounts.

DO $$
DECLARE
  con record;
  branding_fk_businesses boolean;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'agency_branding'
  ) THEN
    RETURN;
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class ref ON ref.oid = c.confrelid
    WHERE c.conrelid = 'public.agency_branding'::regclass
      AND c.contype = 'f'
      AND ref.relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
      AND ref.relname = 'businesses'
  ) INTO branding_fk_businesses;

  IF NOT branding_fk_businesses THEN
    -- Ensure accounts FK exists when table was created without one / wrong parent.
    IF NOT EXISTS (
      SELECT 1
      FROM pg_constraint c
      JOIN pg_class ref ON ref.oid = c.confrelid
      WHERE c.conrelid = 'public.agency_branding'::regclass
        AND c.contype = 'f'
        AND ref.relname = 'accounts'
    ) THEN
      ALTER TABLE public.agency_branding
        ADD CONSTRAINT agency_branding_business_id_fkey
        FOREIGN KEY (business_id) REFERENCES public.accounts(id) ON DELETE CASCADE;
    END IF;
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'businesses'
  ) THEN
    RAISE NOTICE 'repair_agency_branding_business_fk_to_accounts: public.businesses missing; skipped.';
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'businesses'
      AND column_name = 'account_id'
  ) THEN
    RAISE NOTICE 'repair_agency_branding_business_fk_to_accounts: businesses.account_id missing.';
    RETURN;
  END IF;

  UPDATE public.agency_branding ab
  SET business_id = b.account_id
  FROM public.businesses b
  WHERE ab.business_id = b.id
    AND b.account_id IS NOT NULL;

  IF EXISTS (
    SELECT 1
    FROM public.agency_branding ab
    INNER JOIN public.businesses b ON b.id = ab.business_id
    WHERE b.account_id IS NULL
  ) THEN
    RAISE EXCEPTION
      'repair_agency_branding_business_fk_to_accounts: businesses.account_id is NULL for a business that still owns branding rows. Backfill businesses.account_id, then re-run.'
      USING HINT = 'Example: UPDATE public.businesses SET account_id = ''<accounts.id>'' WHERE id = ''<businesses.id>'';';
  END IF;

  -- Drop rows that neither match an account nor a remappable business.
  DELETE FROM public.agency_branding ab
  WHERE NOT EXISTS (SELECT 1 FROM public.accounts a WHERE a.id = ab.business_id)
    AND NOT EXISTS (
      SELECT 1 FROM public.businesses b WHERE b.id = ab.business_id
    );

  FOR con IN
    SELECT c.conname
    FROM pg_constraint c
    JOIN pg_class ref ON ref.oid = c.confrelid
    WHERE c.conrelid = 'public.agency_branding'::regclass
      AND c.contype = 'f'
      AND ref.relname = 'businesses'
  LOOP
    EXECUTE format('ALTER TABLE public.agency_branding DROP CONSTRAINT %I', con.conname);
  END LOOP;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class ref ON ref.oid = c.confrelid
    WHERE c.conrelid = 'public.agency_branding'::regclass
      AND c.contype = 'f'
      AND ref.relname = 'accounts'
  ) THEN
    ALTER TABLE public.agency_branding
      ADD CONSTRAINT agency_branding_business_id_fkey
      FOREIGN KEY (business_id) REFERENCES public.accounts(id) ON DELETE CASCADE;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS agency_branding_business_id_key
  ON public.agency_branding (business_id);

NOTIFY pgrst, 'reload schema';
