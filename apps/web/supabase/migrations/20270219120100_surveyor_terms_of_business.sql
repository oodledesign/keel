-- Surveyor quotes / terms of business: trading name, ToB flags, signing audit,
-- saved firm signature, and quote template overrides. Additive only.

-- ---------------------------------------------------------------------------
-- 1. Trading name on brand settings
-- ---------------------------------------------------------------------------
ALTER TABLE public.account_brand_settings
  ADD COLUMN IF NOT EXISTS trading_name text;

COMMENT ON COLUMN public.account_brand_settings.trading_name IS
  'Optional trading / brand name (e.g. Bracketts LLP) used in emails as {{account.name}}. Falls back to accounts.name.';

-- ---------------------------------------------------------------------------
-- 2. Terms of business flags on templates and contracts
-- ---------------------------------------------------------------------------
ALTER TABLE public.contract_templates
  ADD COLUMN IF NOT EXISTS survey_type text,
  ADD COLUMN IF NOT EXISTS is_terms_of_business boolean NOT NULL DEFAULT false;

ALTER TABLE public.contracts
  ADD COLUMN IF NOT EXISTS is_terms_of_business boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS signed_pdf_path text,
  ADD COLUMN IF NOT EXISTS signed_pdf_sha256 text,
  ADD COLUMN IF NOT EXISTS recipient_signed_ip text,
  ADD COLUMN IF NOT EXISTS recipient_signed_user_agent text,
  ADD COLUMN IF NOT EXISTS author_signed_ip text,
  ADD COLUMN IF NOT EXISTS author_signed_user_agent text;

-- ---------------------------------------------------------------------------
-- 3. Per-signer audit columns
-- ---------------------------------------------------------------------------
ALTER TABLE public.contract_signers
  ADD COLUMN IF NOT EXISTS signed_ip text,
  ADD COLUMN IF NOT EXISTS signed_user_agent text;

-- ---------------------------------------------------------------------------
-- 4. Surveyor settings: saved ToB signature + quote template overrides
-- ---------------------------------------------------------------------------
ALTER TABLE public.survey_account_settings
  ADD COLUMN IF NOT EXISTS tob_signatory_name text,
  ADD COLUMN IF NOT EXISTS tob_signatory_title text,
  ADD COLUMN IF NOT EXISTS tob_signature_type text,
  ADD COLUMN IF NOT EXISTS tob_signature_data text,
  ADD COLUMN IF NOT EXISTS quote_templates jsonb NOT NULL DEFAULT '{}'::jsonb;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'survey_account_settings_tob_signature_type_check'
  ) THEN
    ALTER TABLE public.survey_account_settings
      ADD CONSTRAINT survey_account_settings_tob_signature_type_check
      CHECK (
        tob_signature_type IS NULL
        OR tob_signature_type IN ('drawn', 'typed')
      );
  END IF;
END $$;

COMMENT ON COLUMN public.survey_account_settings.quote_templates IS
  'Optional HTML overrides keyed by survey type (rics_hss_l2, rics_hss_l3, commercial_condition).';

NOTIFY pgrst, 'reload schema';
