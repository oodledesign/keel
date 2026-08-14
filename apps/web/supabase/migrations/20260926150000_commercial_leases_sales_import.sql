-- Sales & lettings register: support sales + Kato external ids for historic import.

ALTER TABLE public.commercial_leases
  ADD COLUMN IF NOT EXISTS transaction_kind text NOT NULL DEFAULT 'letting',
  ADD COLUMN IF NOT EXISTS external_id text,
  ADD COLUMN IF NOT EXISTS headline_price_pence bigint;

ALTER TABLE public.commercial_leases
  DROP CONSTRAINT IF EXISTS commercial_leases_transaction_kind_check;

ALTER TABLE public.commercial_leases
  ADD CONSTRAINT commercial_leases_transaction_kind_check
  CHECK (transaction_kind IN ('letting', 'sale'));

-- Completed = closed sale / completed letting from historic register.
ALTER TABLE public.commercial_leases
  DROP CONSTRAINT IF EXISTS commercial_leases_status_check;

ALTER TABLE public.commercial_leases
  ADD CONSTRAINT commercial_leases_status_check
  CHECK (status IN ('active', 'expired', 'terminated', 'completed'));

CREATE UNIQUE INDEX IF NOT EXISTS commercial_leases_account_external_id_uidx
  ON public.commercial_leases (account_id, external_id)
  WHERE external_id IS NOT NULL;

COMMENT ON COLUMN public.commercial_leases.transaction_kind IS
  'letting | sale — Sales & lettings register kind.';

COMMENT ON COLUMN public.commercial_leases.external_id IS
  'Idempotent import key (e.g. Kato transaction ID).';

COMMENT ON COLUMN public.commercial_leases.headline_price_pence IS
  'Sale headline price in pence (sales only).';
