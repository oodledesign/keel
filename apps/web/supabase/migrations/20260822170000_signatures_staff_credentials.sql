-- Post-nominals / accreditations shown via {{credentials}} in signature templates.

ALTER TABLE signatures.staff
  ADD COLUMN IF NOT EXISTS credentials text;

COMMENT ON COLUMN signatures.staff.credentials IS
  'Optional post-nominals or accreditations (e.g. LLB, TEP) rendered by {{credentials}}.';

NOTIFY pgrst, 'reload schema';
