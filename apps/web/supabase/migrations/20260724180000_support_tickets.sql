-- Align support_tickets / ticket_messages with app code.
-- Production may already have support_tickets with account_id instead of business_id.

CREATE TABLE IF NOT EXISTS public.support_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL DEFAULT 'Untitled',
  status text NOT NULL DEFAULT 'open',
  priority text NOT NULL DEFAULT 'medium',
  ticket_number integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.support_tickets ADD COLUMN IF NOT EXISTS account_id uuid;
ALTER TABLE public.support_tickets ADD COLUMN IF NOT EXISTS business_id uuid;
ALTER TABLE public.support_tickets ADD COLUMN IF NOT EXISTS client_org_id uuid;
ALTER TABLE public.support_tickets ADD COLUMN IF NOT EXISTS website_id uuid;
ALTER TABLE public.support_tickets ADD COLUMN IF NOT EXISTS title text;
ALTER TABLE public.support_tickets ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE public.support_tickets ADD COLUMN IF NOT EXISTS status text;
ALTER TABLE public.support_tickets ADD COLUMN IF NOT EXISTS priority text;
ALTER TABLE public.support_tickets ADD COLUMN IF NOT EXISTS ticket_number integer;
ALTER TABLE public.support_tickets ADD COLUMN IF NOT EXISTS assigned_to uuid;
ALTER TABLE public.support_tickets ADD COLUMN IF NOT EXISTS created_by uuid;
ALTER TABLE public.support_tickets ADD COLUMN IF NOT EXISTS resolved_at timestamptz;
ALTER TABLE public.support_tickets ADD COLUMN IF NOT EXISTS created_at timestamptz;
ALTER TABLE public.support_tickets ADD COLUMN IF NOT EXISTS updated_at timestamptz;

UPDATE public.support_tickets
SET business_id = account_id
WHERE business_id IS NULL
  AND account_id IS NOT NULL;

UPDATE public.support_tickets
SET account_id = business_id
WHERE account_id IS NULL
  AND business_id IS NOT NULL;

UPDATE public.support_tickets SET title = 'Untitled' WHERE title IS NULL;
UPDATE public.support_tickets SET status = 'open' WHERE status IS NULL;
UPDATE public.support_tickets SET priority = 'medium' WHERE priority IS NULL;
UPDATE public.support_tickets SET ticket_number = 1 WHERE ticket_number IS NULL;
UPDATE public.support_tickets SET created_at = now() WHERE created_at IS NULL;
UPDATE public.support_tickets SET updated_at = now() WHERE updated_at IS NULL;

ALTER TABLE public.support_tickets ALTER COLUMN title SET DEFAULT 'Untitled';
ALTER TABLE public.support_tickets ALTER COLUMN status SET DEFAULT 'open';
ALTER TABLE public.support_tickets ALTER COLUMN priority SET DEFAULT 'medium';
ALTER TABLE public.support_tickets ALTER COLUMN ticket_number SET DEFAULT 1;
ALTER TABLE public.support_tickets ALTER COLUMN created_at SET DEFAULT now();
ALTER TABLE public.support_tickets ALTER COLUMN updated_at SET DEFAULT now();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'support_tickets_status_check'
  ) THEN
    ALTER TABLE public.support_tickets
      ADD CONSTRAINT support_tickets_status_check
      CHECK (status IN ('open', 'in-progress', 'waiting', 'resolved', 'closed'));
  END IF;
EXCEPTION
  WHEN check_violation THEN
    RAISE NOTICE 'support_tickets_status_check skipped: invalid legacy status values';
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'support_tickets_priority_check'
  ) THEN
    ALTER TABLE public.support_tickets
      ADD CONSTRAINT support_tickets_priority_check
      CHECK (priority IN ('low', 'medium', 'high', 'urgent'));
  END IF;
EXCEPTION
  WHEN check_violation THEN
    RAISE NOTICE 'support_tickets_priority_check skipped: invalid legacy priority values';
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'support_tickets'
      AND column_name = 'business_id'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'support_tickets_business_id_fkey'
  ) THEN
    ALTER TABLE public.support_tickets
      ADD CONSTRAINT support_tickets_business_id_fkey
      FOREIGN KEY (business_id) REFERENCES public.accounts (id) ON DELETE CASCADE;
  END IF;
EXCEPTION
  WHEN foreign_key_violation THEN
    RAISE NOTICE 'support_tickets.business_id FK skipped: orphan rows';
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'support_tickets'
      AND column_name = 'account_id'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'support_tickets_account_id_fkey'
  ) THEN
    ALTER TABLE public.support_tickets
      ADD CONSTRAINT support_tickets_account_id_fkey
      FOREIGN KEY (account_id) REFERENCES public.accounts (id) ON DELETE CASCADE;
  END IF;
EXCEPTION
  WHEN foreign_key_violation THEN
    RAISE NOTICE 'support_tickets.account_id FK skipped: orphan rows';
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'client_orgs'
  ) AND EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'support_tickets'
      AND column_name = 'client_org_id'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'support_tickets_client_org_id_fkey'
  ) THEN
    ALTER TABLE public.support_tickets
      ADD CONSTRAINT support_tickets_client_org_id_fkey
      FOREIGN KEY (client_org_id) REFERENCES public.client_orgs (id) ON DELETE SET NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'websites'
  ) AND EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'support_tickets'
      AND column_name = 'website_id'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'support_tickets_website_id_fkey'
  ) THEN
    ALTER TABLE public.support_tickets
      ADD CONSTRAINT support_tickets_website_id_fkey
      FOREIGN KEY (website_id) REFERENCES public.websites (id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS ix_support_tickets_account_id
  ON public.support_tickets (account_id);

CREATE INDEX IF NOT EXISTS ix_support_tickets_business_id
  ON public.support_tickets (business_id);

CREATE INDEX IF NOT EXISTS ix_support_tickets_client_org_id
  ON public.support_tickets (client_org_id);

CREATE INDEX IF NOT EXISTS ix_support_tickets_status
  ON public.support_tickets (status);

DO $$
BEGIN
  CREATE UNIQUE INDEX IF NOT EXISTS ix_support_tickets_account_ticket_number
    ON public.support_tickets (account_id, ticket_number)
    WHERE account_id IS NOT NULL;
EXCEPTION
  WHEN unique_violation THEN
    RAISE NOTICE 'ix_support_tickets_account_ticket_number skipped: duplicate ticket numbers';
END $$;

DO $$
BEGIN
  CREATE UNIQUE INDEX IF NOT EXISTS ix_support_tickets_business_ticket_number
    ON public.support_tickets (business_id, ticket_number)
    WHERE business_id IS NOT NULL;
EXCEPTION
  WHEN unique_violation THEN
    RAISE NOTICE 'ix_support_tickets_business_ticket_number skipped: duplicate ticket numbers';
END $$;

CREATE TABLE IF NOT EXISTS public.ticket_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL,
  user_id uuid NOT NULL,
  message text NOT NULL,
  is_internal boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.ticket_messages ADD COLUMN IF NOT EXISTS ticket_id uuid;
ALTER TABLE public.ticket_messages ADD COLUMN IF NOT EXISTS user_id uuid;
ALTER TABLE public.ticket_messages ADD COLUMN IF NOT EXISTS message text;
ALTER TABLE public.ticket_messages ADD COLUMN IF NOT EXISTS is_internal boolean;
ALTER TABLE public.ticket_messages ADD COLUMN IF NOT EXISTS created_at timestamptz;

UPDATE public.ticket_messages SET is_internal = false WHERE is_internal IS NULL;
UPDATE public.ticket_messages SET created_at = now() WHERE created_at IS NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ticket_messages_ticket_id_fkey'
  ) THEN
    ALTER TABLE public.ticket_messages
      ADD CONSTRAINT ticket_messages_ticket_id_fkey
      FOREIGN KEY (ticket_id) REFERENCES public.support_tickets (id) ON DELETE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS ix_ticket_messages_ticket_id
  ON public.ticket_messages (ticket_id);

ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ticket_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS support_tickets_select ON public.support_tickets;
CREATE POLICY support_tickets_select ON public.support_tickets
  FOR SELECT TO authenticated
  USING (
    public.has_role_on_account(COALESCE(business_id, account_id))
  );

DROP POLICY IF EXISTS support_tickets_insert ON public.support_tickets;
CREATE POLICY support_tickets_insert ON public.support_tickets
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role_on_account(COALESCE(business_id, account_id))
  );

DROP POLICY IF EXISTS support_tickets_update ON public.support_tickets;
CREATE POLICY support_tickets_update ON public.support_tickets
  FOR UPDATE TO authenticated
  USING (
    public.has_role_on_account(COALESCE(business_id, account_id))
  )
  WITH CHECK (
    public.has_role_on_account(COALESCE(business_id, account_id))
  );

DROP POLICY IF EXISTS support_tickets_delete ON public.support_tickets;
CREATE POLICY support_tickets_delete ON public.support_tickets
  FOR DELETE TO authenticated
  USING (
    public.has_role_on_account(COALESCE(business_id, account_id))
  );

DROP POLICY IF EXISTS ticket_messages_select ON public.ticket_messages;
CREATE POLICY ticket_messages_select ON public.ticket_messages
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.support_tickets t
      WHERE t.id = ticket_messages.ticket_id
        AND public.has_role_on_account(COALESCE(t.business_id, t.account_id))
    )
  );

DROP POLICY IF EXISTS ticket_messages_insert ON public.ticket_messages;
CREATE POLICY ticket_messages_insert ON public.ticket_messages
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.support_tickets t
      WHERE t.id = ticket_messages.ticket_id
        AND public.has_role_on_account(COALESCE(t.business_id, t.account_id))
    )
  );

DROP TRIGGER IF EXISTS support_tickets_set_updated_at ON public.support_tickets;
CREATE TRIGGER support_tickets_set_updated_at
  BEFORE UPDATE ON public.support_tickets
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_set_timestamps();

GRANT SELECT, INSERT, UPDATE, DELETE ON public.support_tickets TO authenticated;
GRANT SELECT, INSERT ON public.ticket_messages TO authenticated;
GRANT ALL ON public.support_tickets, public.ticket_messages TO postgres, service_role;

COMMENT ON TABLE public.support_tickets IS
  'Workspace support inbox tickets (team + client portal).';

COMMENT ON TABLE public.ticket_messages IS
  'Thread messages on support_tickets.';
