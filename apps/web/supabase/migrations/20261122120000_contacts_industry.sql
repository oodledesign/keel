-- First-class industry on CRM contacts (Campaigns lists, CSV, filters).
-- Categories remain tags; this is a person-level attribute.

ALTER TABLE public.contacts
  ADD COLUMN IF NOT EXISTS industry text;

COMMENT ON COLUMN public.contacts.industry IS
  'Optional industry / sector for the contact (Campaigns lists, CSV import, filters).';

CREATE INDEX IF NOT EXISTS ix_contacts_account_industry
  ON public.contacts (account_id, lower(industry))
  WHERE industry IS NOT NULL AND trim(industry) <> '';

NOTIFY pgrst, 'reload schema';
