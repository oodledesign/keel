-- Keel CRM: clients table. Schema has no accounts table — team/workspace = businesses only.
-- account_id here = business id (FK to businesses). Optional client_org_id = key contact for that org.
-- client_orgs can have many members; one client row can be the key contact via client_org_id.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'clients'
  ) THEN
    CREATE TABLE public.clients (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      -- team/account = businesses in this schema
      account_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
      -- optional: this client is the key contact for this org
      client_org_id uuid REFERENCES public.client_orgs(id) ON DELETE SET NULL,
      display_name text NOT NULL,
      first_name text,
      last_name text,
      company_name text,
      email text,
      phone text,
      address_line_1 text,
      address_line_2 text,
      city text,
      postcode text,
      country text,
      created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
      created_at timestamptz DEFAULT now(),
      updated_at timestamptz DEFAULT now()
    );

    CREATE INDEX IF NOT EXISTS ix_clients_account_id ON public.clients(account_id);
    CREATE INDEX IF NOT EXISTS ix_clients_client_org_id ON public.clients(client_org_id);
    CREATE INDEX IF NOT EXISTS ix_clients_email ON public.clients(email);

    COMMENT ON TABLE public.clients IS 'Keel CRM: client contacts; account_id = business (team). Optional client_org_id = key contact for that org.';
    COMMENT ON COLUMN public.clients.client_org_id IS 'When set, this client is the key contact for this client_org.';

    ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

    -- RLS: allow members of the business to manage clients (adjust if your business_members shape differs)
    CREATE POLICY clients_select ON public.clients FOR SELECT TO authenticated
    USING (
      EXISTS (
        SELECT 1 FROM public.business_members bm
        WHERE bm.business_id = clients.account_id AND bm.user_id = auth.uid()
      )
    );
    CREATE POLICY clients_insert ON public.clients FOR INSERT TO authenticated
    WITH CHECK (
      EXISTS (
        SELECT 1 FROM public.business_members bm
        WHERE bm.business_id = clients.account_id AND bm.user_id = auth.uid()
      )
    );
    CREATE POLICY clients_update ON public.clients FOR UPDATE TO authenticated
    USING (
      EXISTS (
        SELECT 1 FROM public.business_members bm
        WHERE bm.business_id = clients.account_id AND bm.user_id = auth.uid()
      )
    );
    CREATE POLICY clients_delete ON public.clients FOR DELETE TO authenticated
    USING (
      EXISTS (
        SELECT 1 FROM public.business_members bm
        WHERE bm.business_id = clients.account_id AND bm.user_id = auth.uid()
      )
    );
  END IF;
END $$;

-- client_notes: internal notes per client (Keel CRM)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'client_notes'
  ) THEN
    CREATE TABLE public.client_notes (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
      account_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
      author_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
      note text NOT NULL,
      created_at timestamptz DEFAULT now()
    );

    CREATE INDEX IF NOT EXISTS ix_client_notes_client_id ON public.client_notes(client_id);
    CREATE INDEX IF NOT EXISTS ix_client_notes_account_id ON public.client_notes(account_id);

    COMMENT ON TABLE public.client_notes IS 'Internal notes on a client (Keel CRM).';

    ALTER TABLE public.client_notes ENABLE ROW LEVEL SECURITY;

    CREATE POLICY client_notes_select ON public.client_notes FOR SELECT TO authenticated
    USING (
      EXISTS (
        SELECT 1 FROM public.business_members bm
        WHERE bm.business_id = client_notes.account_id AND bm.user_id = auth.uid()
      )
    );
    CREATE POLICY client_notes_insert ON public.client_notes FOR INSERT TO authenticated
    WITH CHECK (
      EXISTS (
        SELECT 1 FROM public.business_members bm
        WHERE bm.business_id = client_notes.account_id AND bm.user_id = auth.uid()
      )
    );
    CREATE POLICY client_notes_delete ON public.client_notes FOR DELETE TO authenticated
    USING (
      EXISTS (
        SELECT 1 FROM public.business_members bm
        WHERE bm.business_id = client_notes.account_id AND bm.user_id = auth.uid()
      )
    );
  END IF;
END $$;
