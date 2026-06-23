-- Allow one contact to be linked to multiple CRM clients via a junction table.

-- ─── 1. Workspace scope on contacts ───────────────────────────────────────────
ALTER TABLE public.contacts
  ADD COLUMN IF NOT EXISTS account_id uuid REFERENCES public.accounts(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS ix_contacts_account_id ON public.contacts(account_id);

UPDATE public.contacts c
SET account_id = cl.account_id
FROM public.clients cl
WHERE c.client_id = cl.id
  AND c.account_id IS NULL;

COMMENT ON COLUMN public.contacts.account_id IS
  'Team workspace that owns this contact person record.';

-- ─── 2. Junction: client ↔ contact ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.client_contacts (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id   uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  contact_id  uuid NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  role        text,
  is_primary  boolean NOT NULL DEFAULT false,
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now(),
  UNIQUE (client_id, contact_id)
);

CREATE INDEX IF NOT EXISTS ix_client_contacts_client_id ON public.client_contacts(client_id);
CREATE INDEX IF NOT EXISTS ix_client_contacts_contact_id ON public.client_contacts(contact_id);

COMMENT ON TABLE public.client_contacts IS
  'Links a contact person to one or more CRM clients (role/primary are per-client).';

DROP TRIGGER IF EXISTS client_contacts_set_updated_at ON public.client_contacts;
CREATE TRIGGER client_contacts_set_updated_at
  BEFORE UPDATE ON public.client_contacts
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_set_timestamps();

-- Backfill links from legacy contacts.client_id
INSERT INTO public.client_contacts (client_id, contact_id, role, is_primary)
SELECT c.client_id, c.id, c.role, c.is_primary
FROM public.contacts c
WHERE c.client_id IS NOT NULL
ON CONFLICT (client_id, contact_id) DO NOTHING;

-- ─── 3. RLS for client_contacts ───────────────────────────────────────────────
ALTER TABLE public.client_contacts ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_contacts TO authenticated, service_role;

DROP POLICY IF EXISTS client_contacts_select ON public.client_contacts;
CREATE POLICY client_contacts_select ON public.client_contacts FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.clients c
    JOIN public.accounts_memberships am ON am.account_id = c.account_id
    WHERE c.id = client_contacts.client_id AND am.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS client_contacts_insert ON public.client_contacts;
CREATE POLICY client_contacts_insert ON public.client_contacts FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.clients c
    JOIN public.accounts_memberships am ON am.account_id = c.account_id
    WHERE c.id = client_contacts.client_id AND am.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS client_contacts_update ON public.client_contacts;
CREATE POLICY client_contacts_update ON public.client_contacts FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.clients c
    JOIN public.accounts_memberships am ON am.account_id = c.account_id
    WHERE c.id = client_contacts.client_id AND am.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.clients c
    JOIN public.accounts_memberships am ON am.account_id = c.account_id
    WHERE c.id = client_contacts.client_id AND am.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS client_contacts_delete ON public.client_contacts;
CREATE POLICY client_contacts_delete ON public.client_contacts FOR DELETE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.clients c
    JOIN public.accounts_memberships am ON am.account_id = c.account_id
    WHERE c.id = client_contacts.client_id AND am.user_id = auth.uid()
  )
);

-- ─── 4. Extend contacts RLS for account members ───────────────────────────────
DROP POLICY IF EXISTS contacts_select ON public.contacts;
CREATE POLICY contacts_select ON public.contacts FOR SELECT TO authenticated
USING (
  user_id = auth.uid()
  OR (
    account_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.accounts_memberships am
      WHERE am.account_id = contacts.account_id AND am.user_id = auth.uid()
    )
  )
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
    account_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.accounts_memberships am
      WHERE am.account_id = contacts.account_id AND am.user_id = auth.uid()
    )
  )
  OR (
    client_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.clients c
      JOIN public.accounts_memberships am ON am.account_id = c.account_id
      WHERE c.id = contacts.client_id AND am.user_id = auth.uid()
    )
  )
);

NOTIFY pgrst, 'reload schema';
