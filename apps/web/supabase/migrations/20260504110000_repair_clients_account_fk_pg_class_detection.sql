-- Follow-up to 20260504100000: detection used pg_get_constraintdef ILIKE '%public.businesses%'
-- but Postgres often emits REFERENCES businesses(id) without the schema prefix, so the
-- repair never ran. Detect FK target via pg_constraint.confrelid → pg_class.relname.

DO $$
DECLARE
  con record;
  clients_fk_businesses boolean;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'clients'
  ) THEN
    RETURN;
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class ref ON ref.oid = c.confrelid
    WHERE c.conrelid = 'public.clients'::regclass
      AND c.contype = 'f'
      AND ref.relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
      AND ref.relname = 'businesses'
  ) INTO clients_fk_businesses;

  IF NOT clients_fk_businesses THEN
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'businesses'
  ) THEN
    RAISE NOTICE 'repair_clients_account_fk_pg_class: public.businesses missing; skipped.';
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'businesses'
      AND column_name = 'account_id'
  ) THEN
    RAISE NOTICE 'repair_clients_account_fk_pg_class: businesses.account_id missing. Apply workspace pipeline migration first.';
    RETURN;
  END IF;

  UPDATE public.clients c
  SET account_id = b.account_id
  FROM public.businesses b
  WHERE c.account_id = b.id
    AND b.account_id IS NOT NULL;

  IF EXISTS (
    SELECT 1
    FROM public.clients c
    INNER JOIN public.businesses b ON b.id = c.account_id
    WHERE b.account_id IS NULL
  ) THEN
    RAISE EXCEPTION
      'repair_clients_account_fk_pg_class: set public.businesses.account_id for every business row that still matches clients.account_id (business id), then re-run.'
      USING HINT = 'UPDATE public.businesses SET account_id = ''<accounts.id>'' WHERE id = ''<businesses.id>'';';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'client_notes'
  ) THEN
    UPDATE public.client_notes n
    SET account_id = c.account_id
    FROM public.clients c
    WHERE n.client_id = c.id;

    DELETE FROM public.client_notes n
    WHERE NOT EXISTS (
      SELECT 1 FROM public.accounts a WHERE a.id = n.account_id
    );
  END IF;

  DELETE FROM public.clients c
  WHERE NOT EXISTS (SELECT 1 FROM public.accounts a WHERE a.id = c.account_id)
    AND NOT EXISTS (
      SELECT 1 FROM public.businesses b WHERE b.id = c.account_id
    );

  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'client_notes'
  ) THEN
    FOR con IN
      SELECT c.conname
      FROM pg_constraint c
      JOIN pg_class ref ON ref.oid = c.confrelid
      WHERE c.conrelid = 'public.client_notes'::regclass
        AND c.contype = 'f'
        AND ref.relname = 'businesses'
    LOOP
      EXECUTE format('ALTER TABLE public.client_notes DROP CONSTRAINT %I', con.conname);
    END LOOP;

    IF NOT EXISTS (
      SELECT 1
      FROM pg_constraint c
      JOIN pg_class ref ON ref.oid = c.confrelid
      WHERE c.conrelid = 'public.client_notes'::regclass
        AND c.contype = 'f'
        AND ref.relname = 'accounts'
    ) THEN
      ALTER TABLE public.client_notes
        ADD CONSTRAINT client_notes_account_id_fkey
        FOREIGN KEY (account_id) REFERENCES public.accounts(id) ON DELETE CASCADE;
    END IF;
  END IF;

  FOR con IN
    SELECT c.conname
    FROM pg_constraint c
    JOIN pg_class ref ON ref.oid = c.confrelid
    WHERE c.conrelid = 'public.clients'::regclass
      AND c.contype = 'f'
      AND ref.relname = 'businesses'
  LOOP
    EXECUTE format('ALTER TABLE public.clients DROP CONSTRAINT %I', con.conname);
  END LOOP;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class ref ON ref.oid = c.confrelid
    WHERE c.conrelid = 'public.clients'::regclass
      AND c.contype = 'f'
      AND ref.relname = 'accounts'
  ) THEN
    ALTER TABLE public.clients
      ADD CONSTRAINT clients_account_id_fkey
      FOREIGN KEY (account_id) REFERENCES public.accounts(id) ON DELETE CASCADE;
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
