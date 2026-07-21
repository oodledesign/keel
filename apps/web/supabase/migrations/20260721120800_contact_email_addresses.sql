-- Multiple email addresses per contact while preserving contacts.email as the
-- backwards-compatible primary address used by notifications and integrations.

CREATE TABLE IF NOT EXISTS public.contact_email_addresses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  contact_id uuid NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  email text NOT NULL,
  label text NOT NULL DEFAULT 'work'
    CHECK (label IN ('work', 'personal', 'billing', 'other')),
  is_primary boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (email = trim(email) AND email <> '' AND position('@' IN email) > 1)
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_contact_email_addresses_contact_email
  ON public.contact_email_addresses(contact_id, lower(email));

CREATE UNIQUE INDEX IF NOT EXISTS ux_contact_email_addresses_one_primary
  ON public.contact_email_addresses(contact_id)
  WHERE is_primary;

CREATE INDEX IF NOT EXISTS ix_contact_email_addresses_account_contact
  ON public.contact_email_addresses(account_id, contact_id);

COMMENT ON TABLE public.contact_email_addresses IS
  'Email addresses belonging to a contact. contacts.email mirrors the primary address for backwards compatibility.';

DROP TRIGGER IF EXISTS contact_email_addresses_set_updated_at
  ON public.contact_email_addresses;
CREATE TRIGGER contact_email_addresses_set_updated_at
  BEFORE UPDATE ON public.contact_email_addresses
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_set_timestamps();

INSERT INTO public.contact_email_addresses (
  account_id,
  contact_id,
  email,
  label,
  is_primary
)
SELECT account_id, id, trim(email), 'work', true
FROM public.contacts
WHERE account_id IS NOT NULL
  AND email IS NOT NULL
  AND trim(email) <> ''
ON CONFLICT DO NOTHING;

ALTER TABLE public.contact_email_addresses ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE
  ON public.contact_email_addresses
  TO authenticated, service_role;

DROP POLICY IF EXISTS contact_email_addresses_select
  ON public.contact_email_addresses;
CREATE POLICY contact_email_addresses_select
  ON public.contact_email_addresses
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.accounts_memberships membership
      WHERE membership.account_id = contact_email_addresses.account_id
        AND membership.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS contact_email_addresses_insert
  ON public.contact_email_addresses;
CREATE POLICY contact_email_addresses_insert
  ON public.contact_email_addresses
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.accounts_memberships membership
      WHERE membership.account_id = contact_email_addresses.account_id
        AND membership.user_id = auth.uid()
    )
    AND EXISTS (
      SELECT 1
      FROM public.contacts contact
      WHERE contact.id = contact_email_addresses.contact_id
        AND contact.account_id = contact_email_addresses.account_id
    )
  );

DROP POLICY IF EXISTS contact_email_addresses_update
  ON public.contact_email_addresses;
CREATE POLICY contact_email_addresses_update
  ON public.contact_email_addresses
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.accounts_memberships membership
      WHERE membership.account_id = contact_email_addresses.account_id
        AND membership.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.accounts_memberships membership
      WHERE membership.account_id = contact_email_addresses.account_id
        AND membership.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS contact_email_addresses_delete
  ON public.contact_email_addresses;
CREATE POLICY contact_email_addresses_delete
  ON public.contact_email_addresses
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.accounts_memberships membership
      WHERE membership.account_id = contact_email_addresses.account_id
        AND membership.user_id = auth.uid()
    )
  );

CREATE OR REPLACE FUNCTION public.replace_contact_email_addresses(
  p_account_id uuid,
  p_contact_id uuid,
  p_addresses jsonb
)
RETURNS void
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  address jsonb;
  address_count integer := 0;
  primary_count integer := 0;
  first_address_id uuid;
  normalized_email text;
  normalized_label text;
  inserted_id uuid;
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.contacts
    WHERE id = p_contact_id
      AND account_id = p_account_id
  ) THEN
    RAISE EXCEPTION 'Contact not found in this workspace'
      USING ERRCODE = 'P0002';
  END IF;

  IF jsonb_typeof(COALESCE(p_addresses, '[]'::jsonb)) <> 'array' THEN
    RAISE EXCEPTION 'Email addresses must be an array'
      USING ERRCODE = '22023';
  END IF;

  IF jsonb_array_length(COALESCE(p_addresses, '[]'::jsonb)) > 10 THEN
    RAISE EXCEPTION 'A contact can have at most 10 email addresses'
      USING ERRCODE = '23514';
  END IF;

  DELETE FROM public.contact_email_addresses
  WHERE contact_id = p_contact_id
    AND account_id = p_account_id;

  FOR address IN
    SELECT value
    FROM jsonb_array_elements(COALESCE(p_addresses, '[]'::jsonb))
  LOOP
    normalized_email := lower(trim(address->>'email'));
    normalized_label := COALESCE(NULLIF(address->>'label', ''), 'work');

    IF normalized_email = '' OR position('@' IN normalized_email) <= 1 THEN
      RAISE EXCEPTION 'Invalid contact email address'
        USING ERRCODE = '23514';
    END IF;

    IF normalized_label NOT IN ('work', 'personal', 'billing', 'other') THEN
      RAISE EXCEPTION 'Invalid contact email label'
        USING ERRCODE = '23514';
    END IF;

    IF COALESCE((address->>'isPrimary')::boolean, false) THEN
      primary_count := primary_count + 1;
      IF primary_count > 1 THEN
        RAISE EXCEPTION 'Only one contact email can be primary'
          USING ERRCODE = '23514';
      END IF;
    END IF;

    INSERT INTO public.contact_email_addresses (
      account_id,
      contact_id,
      email,
      label,
      is_primary
    )
    VALUES (
      p_account_id,
      p_contact_id,
      normalized_email,
      normalized_label,
      COALESCE((address->>'isPrimary')::boolean, false)
    )
    RETURNING id INTO inserted_id;

    address_count := address_count + 1;
    IF first_address_id IS NULL THEN
      first_address_id := inserted_id;
    END IF;
  END LOOP;

  IF address_count > 0 AND primary_count = 0 THEN
    UPDATE public.contact_email_addresses
    SET is_primary = true
    WHERE id = first_address_id;
  END IF;

  UPDATE public.contacts
  SET email = (
    SELECT email
    FROM public.contact_email_addresses
    WHERE contact_id = p_contact_id
      AND account_id = p_account_id
    ORDER BY is_primary DESC, created_at ASC
    LIMIT 1
  ),
  updated_at = now()
  WHERE id = p_contact_id
    AND account_id = p_account_id;
END;
$$;

REVOKE ALL ON FUNCTION public.replace_contact_email_addresses(uuid, uuid, jsonb)
  FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.replace_contact_email_addresses(uuid, uuid, jsonb)
  TO authenticated, service_role;

COMMENT ON FUNCTION public.replace_contact_email_addresses(uuid, uuid, jsonb) IS
  'Atomically replaces a contact email collection and synchronises contacts.email to the primary address.';

NOTIFY pgrst, 'reload schema';
