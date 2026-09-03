-- Contracts phase 4: immutable signed versions.
-- Additive only. Body + terms + parties are frozen into contract_versions
-- at send time. Later edits create a new draft version; the sent/signed
-- snapshot is never mutated. Portal/signing bind to sent_version_id +
-- content_hash so a stale client cannot sign a superseded copy.

ALTER TABLE public.contracts
  ADD COLUMN IF NOT EXISTS current_version_id uuid,
  ADD COLUMN IF NOT EXISTS sent_version_id uuid,
  ADD COLUMN IF NOT EXISTS current_version_number integer NOT NULL DEFAULT 1;

CREATE TABLE IF NOT EXISTS public.contract_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.accounts (id) ON DELETE CASCADE,
  contract_id uuid NOT NULL REFERENCES public.contracts (id) ON DELETE CASCADE,
  version_number integer NOT NULL,
  status text NOT NULL DEFAULT 'draft' CHECK (
    status IN ('draft', 'sent', 'signed', 'superseded')
  ),
  content_html text NOT NULL DEFAULT '',
  content_hash text NOT NULL,
  title text NOT NULL DEFAULT 'Agreement',
  total_pence integer NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'gbp',
  payment_plan jsonb NOT NULL DEFAULT '[]'::jsonb,
  author_type text,
  author_name text,
  author_company text,
  author_signature_type text,
  author_signature_data text,
  author_signed_at timestamptz,
  recipient_type text,
  recipient_name text,
  recipient_company text,
  recipient_email text,
  recipient_signature_type text,
  recipient_signature_data text,
  recipient_signed_at timestamptz,
  frozen_at timestamptz,
  superseded_at timestamptz,
  superseded_by uuid REFERENCES public.contract_versions (id) ON DELETE SET NULL,
  created_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (contract_id, version_number)
);

CREATE INDEX IF NOT EXISTS ix_contract_versions_contract_id_version_number
  ON public.contract_versions (contract_id, version_number DESC);

CREATE INDEX IF NOT EXISTS ix_contract_versions_account_id
  ON public.contract_versions (account_id);

COMMENT ON TABLE public.contract_versions IS
  'Immutable snapshots of a contract. Draft rows may be updated until send; sent/signed rows are frozen. A new draft version is created to edit after send.';

COMMENT ON COLUMN public.contracts.current_version_id IS
  'Working version: the draft being edited, or the live sent/signed version when no unpublished draft exists.';

COMMENT ON COLUMN public.contracts.sent_version_id IS
  'Frozen version the portal, PDF-by-token, and recipient signing must use. Null until the contract has been sent.';

COMMENT ON COLUMN public.contracts.current_version_number IS
  'Denormalised version_number of current_version_id, for list/detail display without a join.';

-- Backfill version 1 from existing contract rows. The backfill hash is a
-- stable placeholder (md5 of identity + body); the app recomputes the
-- canonical SHA-256 hash on the next send using
-- apps/web/lib/contracts/version-snapshot.ts. Portal signing compares the
-- stored hash to the hash it loaded, never a freshly recomputed one, so
-- already-sent contracts remain signable after migrate.
INSERT INTO public.contract_versions (
  account_id,
  contract_id,
  version_number,
  status,
  content_html,
  content_hash,
  title,
  total_pence,
  currency,
  payment_plan,
  author_type,
  author_name,
  author_company,
  author_signature_type,
  author_signature_data,
  author_signed_at,
  recipient_type,
  recipient_name,
  recipient_company,
  recipient_email,
  recipient_signature_type,
  recipient_signature_data,
  recipient_signed_at,
  frozen_at,
  created_by,
  created_at
)
SELECT
  c.account_id,
  c.id,
  1,
  CASE
    WHEN c.status = 'signed' THEN 'signed'
    WHEN c.status IN ('sent', 'ready_to_sign') THEN 'sent'
    ELSE 'draft'
  END,
  COALESCE(c.content_html, ''),
  md5(
    c.id::text || E'\n' ||
    COALESCE(c.content_html, '') || E'\n' ||
    COALESCE(c.title, '') || E'\n' ||
    COALESCE(c.total_pence, 0)::text
  ),
  COALESCE(NULLIF(btrim(c.title), ''), 'Agreement'),
  COALESCE(c.total_pence, 0),
  COALESCE(c.currency, 'gbp'),
  COALESCE(c.payment_plan, '[]'::jsonb),
  c.author_type,
  c.author_name,
  c.author_company,
  c.author_signature_type,
  c.author_signature_data,
  c.author_signed_at,
  c.recipient_type,
  c.recipient_name,
  c.recipient_company,
  c.recipient_email,
  c.recipient_signature_type,
  c.recipient_signature_data,
  c.recipient_signed_at,
  CASE
    WHEN c.status IN ('sent', 'signed', 'ready_to_sign') THEN COALESCE(c.sent_at, c.updated_at)
    ELSE NULL
  END,
  c.created_by,
  c.created_at
FROM public.contracts c
WHERE NOT EXISTS (
  SELECT 1 FROM public.contract_versions v WHERE v.contract_id = c.id
);

UPDATE public.contracts c
SET
  current_version_id = v.id,
  current_version_number = v.version_number,
  sent_version_id = CASE
    WHEN c.status IN ('sent', 'signed', 'ready_to_sign') THEN v.id
    ELSE c.sent_version_id
  END
FROM public.contract_versions v
WHERE v.contract_id = c.id
  AND v.version_number = 1
  AND c.current_version_id IS NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'contracts_current_version_id_fkey'
  ) THEN
    ALTER TABLE public.contracts
      ADD CONSTRAINT contracts_current_version_id_fkey
      FOREIGN KEY (current_version_id) REFERENCES public.contract_versions (id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'contracts_sent_version_id_fkey'
  ) THEN
    ALTER TABLE public.contracts
      ADD CONSTRAINT contracts_sent_version_id_fkey
      FOREIGN KEY (sent_version_id) REFERENCES public.contract_versions (id) ON DELETE SET NULL;
  END IF;
END $$;

ALTER TABLE public.contract_versions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS contract_versions_select ON public.contract_versions;
DROP POLICY IF EXISTS contract_versions_insert ON public.contract_versions;
DROP POLICY IF EXISTS contract_versions_update ON public.contract_versions;
DROP POLICY IF EXISTS contract_versions_delete ON public.contract_versions;

CREATE POLICY contract_versions_select ON public.contract_versions FOR SELECT TO authenticated
USING (public.has_permission(auth.uid(), account_id, 'invoices.view'::public.app_permissions));

CREATE POLICY contract_versions_insert ON public.contract_versions FOR INSERT TO authenticated
WITH CHECK (public.has_permission(auth.uid(), account_id, 'invoices.edit'::public.app_permissions));

CREATE POLICY contract_versions_update ON public.contract_versions FOR UPDATE TO authenticated
USING (public.has_permission(auth.uid(), account_id, 'invoices.edit'::public.app_permissions));

CREATE POLICY contract_versions_delete ON public.contract_versions FOR DELETE TO authenticated
USING (public.has_permission(auth.uid(), account_id, 'invoices.edit'::public.app_permissions));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.contract_versions TO authenticated;

NOTIFY pgrst, 'reload schema';
