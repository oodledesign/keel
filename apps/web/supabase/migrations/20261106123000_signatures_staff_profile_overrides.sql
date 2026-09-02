-- Ozer-only signature profile overrides. Directory sync keeps writing
-- full_name / job_title / department from Microsoft Graph (or Google).
-- A non-empty override is used at render time; NULL means use the directory value.
-- These columns must never be written back to Entra / Graph / Google Directory.

ALTER TABLE signatures.staff
  ADD COLUMN IF NOT EXISTS full_name_override text,
  ADD COLUMN IF NOT EXISTS job_title_override text,
  ADD COLUMN IF NOT EXISTS department_override text;

COMMENT ON COLUMN signatures.staff.full_name_override IS
  'Optional Ozer-only display name for signatures. NULL uses the Microsoft/Google directory full_name.';

COMMENT ON COLUMN signatures.staff.job_title_override IS
  'Optional Ozer-only job title for signatures. NULL uses the Microsoft/Google directory job_title.';

COMMENT ON COLUMN signatures.staff.department_override IS
  'Optional Ozer-only department for signatures. NULL uses the Microsoft/Google directory department.';

NOTIFY pgrst, 'reload schema';
