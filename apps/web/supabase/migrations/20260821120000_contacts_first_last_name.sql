-- Split contact names into first/last while keeping full_name for legacy readers.
-- Also enforce at most one primary contact per client on client_contacts.

ALTER TABLE public.contacts
  ADD COLUMN IF NOT EXISTS first_name text,
  ADD COLUMN IF NOT EXISTS last_name text;

COMMENT ON COLUMN public.contacts.first_name IS
  'Given name for the contact person. Prefer this over parsing full_name.';
COMMENT ON COLUMN public.contacts.last_name IS
  'Family name for the contact person.';

-- Backfill from existing full_name: first token → first_name, remainder → last_name.
UPDATE public.contacts
SET
  first_name = COALESCE(
    first_name,
    NULLIF(trim(split_part(full_name, ' ', 1)), '')
  ),
  last_name = COALESCE(
    last_name,
    NULLIF(
      trim(substr(full_name, length(split_part(full_name, ' ', 1)) + 1)),
      ''
    )
  )
WHERE full_name IS NOT NULL
  AND trim(full_name) <> ''
  AND (first_name IS NULL OR last_name IS NULL);

CREATE INDEX IF NOT EXISTS ix_contacts_account_first_name
  ON public.contacts (account_id, lower(first_name));

-- Keep a single primary contact per client when is_primary flips to true.
CREATE OR REPLACE FUNCTION public.client_contacts_ensure_single_primary()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.is_primary IS TRUE THEN
    UPDATE public.client_contacts
    SET is_primary = false,
        updated_at = now()
    WHERE client_id = NEW.client_id
      AND contact_id IS DISTINCT FROM NEW.contact_id
      AND is_primary IS TRUE;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS client_contacts_single_primary ON public.client_contacts;
CREATE TRIGGER client_contacts_single_primary
  BEFORE INSERT OR UPDATE OF is_primary ON public.client_contacts
  FOR EACH ROW
  WHEN (NEW.is_primary IS TRUE)
  EXECUTE FUNCTION public.client_contacts_ensure_single_primary();

NOTIFY pgrst, 'reload schema';
