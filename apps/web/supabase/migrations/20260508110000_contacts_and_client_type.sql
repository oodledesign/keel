-- Task 2a: contacts table — individual contacts for clients / client_orgs.
-- Task 2b: client_type on clients and client_orgs to distinguish individual vs business.

-- ─── 1. client_type on the CRM clients table ──────────────────────────────────
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'clients'
  ) THEN
    ALTER TABLE public.clients
      ADD COLUMN IF NOT EXISTS client_type text DEFAULT 'business'
        CHECK (client_type IN ('individual', 'business'));

    COMMENT ON COLUMN public.clients.client_type IS
      'individual = single person client; business = company with multiple contacts.';
  END IF;
END $$;

-- ─── 2. client_type on client_orgs (if it exists) ────────────────────────────
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'client_orgs'
  ) THEN
    ALTER TABLE public.client_orgs
      ADD COLUMN IF NOT EXISTS client_type text DEFAULT 'business'
        CHECK (client_type IN ('individual', 'business'));

    COMMENT ON COLUMN public.client_orgs.client_type IS
      'individual = single person; business = org with multiple contacts.';
  END IF;
END $$;

-- ─── 3. contacts table ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.contacts (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- owner: either personal (user_id) or business context
  user_id        uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  -- link to a CRM client (business type) — used for secondary contacts on a business client
  client_id      uuid REFERENCES public.clients(id) ON DELETE CASCADE,
  -- link to a client_org (if the client_orgs model is used instead)
  client_org_id  uuid,  -- soft FK; actual FK added below if client_orgs exists
  full_name      text NOT NULL,
  email          text,
  phone          text,
  role           text,        -- e.g. "CEO", "Account Manager"
  notes          text,
  is_primary     boolean NOT NULL DEFAULT false,
  created_at     timestamptz DEFAULT now(),
  updated_at     timestamptz DEFAULT now()
);

-- Add FK to client_orgs only if that table exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'client_orgs'
  ) THEN
    ALTER TABLE public.contacts
      DROP CONSTRAINT IF EXISTS contacts_client_org_id_fkey;
    ALTER TABLE public.contacts
      ADD CONSTRAINT contacts_client_org_id_fkey
        FOREIGN KEY (client_org_id) REFERENCES public.client_orgs(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS ix_contacts_user_id ON public.contacts(user_id);
CREATE INDEX IF NOT EXISTS ix_contacts_client_id ON public.contacts(client_id);
CREATE INDEX IF NOT EXISTS ix_contacts_client_org_id ON public.contacts(client_org_id);

COMMENT ON TABLE public.contacts IS
  'Individual contacts. Can link to a CRM client (business) or a client_org.';

-- Timestamp trigger
DROP TRIGGER IF EXISTS contacts_set_updated_at ON public.contacts;
CREATE TRIGGER contacts_set_updated_at
  BEFORE UPDATE ON public.contacts
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_set_timestamps();

-- ─── 4. RLS for contacts ─────────────────────────────────────────────────────
ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.contacts TO authenticated, service_role;

-- Own contacts (user_id = current user)
DROP POLICY IF EXISTS contacts_select ON public.contacts;
CREATE POLICY contacts_select ON public.contacts FOR SELECT TO authenticated
USING (
  user_id = auth.uid()
  OR (
    client_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.clients c
      JOIN public.accounts_memberships am ON am.account_id = c.account_id
      WHERE c.id = contacts.client_id AND am.user_id = auth.uid()
    )
  )
);

DROP POLICY IF EXISTS contacts_insert ON public.contacts;
CREATE POLICY contacts_insert ON public.contacts FOR INSERT TO authenticated
WITH CHECK (
  user_id = auth.uid()
  OR (
    client_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.clients c
      JOIN public.accounts_memberships am ON am.account_id = c.account_id
      WHERE c.id = contacts.client_id AND am.user_id = auth.uid()
    )
  )
);

DROP POLICY IF EXISTS contacts_update ON public.contacts;
CREATE POLICY contacts_update ON public.contacts FOR UPDATE TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS contacts_delete ON public.contacts;
CREATE POLICY contacts_delete ON public.contacts FOR DELETE TO authenticated
USING (user_id = auth.uid());

NOTIFY pgrst, 'reload schema';
