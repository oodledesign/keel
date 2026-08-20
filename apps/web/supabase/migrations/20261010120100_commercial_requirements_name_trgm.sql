-- Trigram indexes for commercial requirements name search (contact / company).
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS commercial_requirements_contact_name_trgm_idx
  ON public.commercial_requirements
  USING gin (contact_name gin_trgm_ops)
  WHERE contact_name IS NOT NULL;

CREATE INDEX IF NOT EXISTS commercial_requirements_company_name_trgm_idx
  ON public.commercial_requirements
  USING gin (company_name gin_trgm_ops)
  WHERE company_name IS NOT NULL;
