-- Requirements board: track details-sent + import external key; keep notes clean.

ALTER TABLE public.commercial_requirements
  ADD COLUMN IF NOT EXISTS details_sent boolean NOT NULL DEFAULT false;

ALTER TABLE public.commercial_requirements
  ADD COLUMN IF NOT EXISTS details_note text;

ALTER TABLE public.commercial_requirements
  ADD COLUMN IF NOT EXISTS external_key text;

COMMENT ON COLUMN public.commercial_requirements.details_sent IS
  'True when particulars / details have been sent to the applicant.';

COMMENT ON COLUMN public.commercial_requirements.details_note IS
  'Optional free-text of what was sent (e.g. listing names).';

COMMENT ON COLUMN public.commercial_requirements.external_key IS
  'Idempotent import key (e.g. Bracketts CSV row key).';

CREATE UNIQUE INDEX IF NOT EXISTS commercial_requirements_account_external_key_uidx
  ON public.commercial_requirements (account_id, external_key)
  WHERE external_key IS NOT NULL;
