-- Workspace-defined custom fields for contacts (public.clients).
-- Definitions live per account; values are stored on the contact as jsonb
-- keyed by the definition key. Mailing-list / sign-up form questions can map
-- to a definition so answers land on the contact.

CREATE TABLE IF NOT EXISTS public.contact_custom_fields (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.accounts (id) ON DELETE CASCADE,
  key text NOT NULL CHECK (key ~ '^[a-z][a-z0-9_]{0,59}$'),
  label text NOT NULL CHECK (char_length(label) BETWEEN 1 AND 80),
  field_type text NOT NULL DEFAULT 'text'
    CHECK (field_type IN ('text', 'number', 'date', 'select', 'checkbox')),
  options jsonb NOT NULL DEFAULT '[]'::jsonb
    CHECK (jsonb_typeof(options) = 'array'),
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT contact_custom_fields_account_key_uidx UNIQUE (account_id, key)
);

CREATE INDEX IF NOT EXISTS ix_contact_custom_fields_account
  ON public.contact_custom_fields (account_id, position);

ALTER TABLE public.contact_custom_fields ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.contact_custom_fields FROM anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.contact_custom_fields
  TO authenticated, service_role;

DROP POLICY IF EXISTS contact_custom_fields_all ON public.contact_custom_fields;
CREATE POLICY contact_custom_fields_all ON public.contact_custom_fields
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.business_members bm
      WHERE bm.business_id = contact_custom_fields.account_id
        AND bm.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.business_members bm
      WHERE bm.business_id = contact_custom_fields.account_id
        AND bm.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS contact_custom_fields_service ON public.contact_custom_fields;
CREATE POLICY contact_custom_fields_service ON public.contact_custom_fields
  FOR ALL TO service_role USING (true) WITH CHECK (true);

ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS custom_fields jsonb NOT NULL DEFAULT '{}'::jsonb;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'clients_custom_fields_is_object'
      AND conrelid = 'public.clients'::regclass
  ) THEN
    ALTER TABLE public.clients
      ADD CONSTRAINT clients_custom_fields_is_object
      CHECK (jsonb_typeof(custom_fields) = 'object');
  END IF;
END $$;

COMMENT ON COLUMN public.clients.custom_fields IS
  'Workspace-defined custom field values keyed by contact_custom_fields.key.';

NOTIFY pgrst, 'reload schema';
