-- Contracts phase 5: multi-party signing order, contract-level signing
-- expiry (distinct from public_token TTL), and an attachments stub.
-- Additive only. File upload for attachments is intentionally not wired;
-- the table exists so a later slice can store files without another
-- contract-row migration.

ALTER TABLE public.contracts
  ADD COLUMN IF NOT EXISTS signing_expires_at timestamptz;

COMMENT ON COLUMN public.contracts.signing_expires_at IS
  'Optional contract-level signing deadline, independent of public_token_expires_at. When set and in the past, portal signing is blocked. NULL means no deadline beyond the shareable-link TTL.';

CREATE TABLE IF NOT EXISTS public.contract_signers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.accounts (id) ON DELETE CASCADE,
  contract_id uuid NOT NULL REFERENCES public.contracts (id) ON DELETE CASCADE,
  version_id uuid REFERENCES public.contract_versions (id) ON DELETE CASCADE,
  signing_order integer NOT NULL,
  role text NOT NULL DEFAULT 'signer' CHECK (role IN ('author', 'signer')),
  party_type text,
  name text,
  email text,
  company text,
  signature_type text,
  signature_data text,
  signed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (contract_id, version_id, signing_order)
);

CREATE INDEX IF NOT EXISTS ix_contract_signers_contract_id_order
  ON public.contract_signers (contract_id, signing_order);

CREATE INDEX IF NOT EXISTS ix_contract_signers_version_id
  ON public.contract_signers (version_id);

COMMENT ON TABLE public.contract_signers IS
  'Ordered signing roster for a contract version. Party N may only sign after parties 1..N-1. Author typically signs in the dashboard (order 1); remaining parties sign via the portal.';

-- Seed author + recipient as the default two-party roster on version 1
-- for existing contracts. Skip rows that already have signers.
INSERT INTO public.contract_signers (
  account_id,
  contract_id,
  version_id,
  signing_order,
  role,
  party_type,
  name,
  email,
  company,
  signature_type,
  signature_data,
  signed_at,
  created_at
)
SELECT
  c.account_id,
  c.id,
  v.id,
  1,
  'author',
  c.author_type,
  c.author_name,
  NULL,
  c.author_company,
  c.author_signature_type,
  c.author_signature_data,
  c.author_signed_at,
  c.created_at
FROM public.contracts c
JOIN public.contract_versions v
  ON v.contract_id = c.id AND v.version_number = 1
WHERE NOT EXISTS (
  SELECT 1 FROM public.contract_signers s WHERE s.contract_id = c.id
);

INSERT INTO public.contract_signers (
  account_id,
  contract_id,
  version_id,
  signing_order,
  role,
  party_type,
  name,
  email,
  company,
  signature_type,
  signature_data,
  signed_at,
  created_at
)
SELECT
  c.account_id,
  c.id,
  v.id,
  2,
  'signer',
  c.recipient_type,
  c.recipient_name,
  COALESCE(c.recipient_email, c.sent_to_email),
  c.recipient_company,
  c.recipient_signature_type,
  c.recipient_signature_data,
  c.recipient_signed_at,
  c.created_at
FROM public.contracts c
JOIN public.contract_versions v
  ON v.contract_id = c.id AND v.version_number = 1
WHERE NOT EXISTS (
  SELECT 1 FROM public.contract_signers s
  WHERE s.contract_id = c.id AND s.signing_order = 2
);

CREATE TABLE IF NOT EXISTS public.contract_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.accounts (id) ON DELETE CASCADE,
  contract_id uuid NOT NULL REFERENCES public.contracts (id) ON DELETE CASCADE,
  version_id uuid REFERENCES public.contract_versions (id) ON DELETE SET NULL,
  file_name text NOT NULL,
  content_type text,
  storage_path text,
  byte_size integer,
  created_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_contract_attachments_contract_id
  ON public.contract_attachments (contract_id, created_at);

COMMENT ON TABLE public.contract_attachments IS
  'Stub for contract file attachments. storage_path is unused until upload is wired; rows may be created as metadata-only placeholders.';

ALTER TABLE public.contract_signers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contract_attachments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS contract_signers_select ON public.contract_signers;
DROP POLICY IF EXISTS contract_signers_insert ON public.contract_signers;
DROP POLICY IF EXISTS contract_signers_update ON public.contract_signers;
DROP POLICY IF EXISTS contract_signers_delete ON public.contract_signers;

CREATE POLICY contract_signers_select ON public.contract_signers FOR SELECT TO authenticated
USING (public.has_permission(auth.uid(), account_id, 'invoices.view'::public.app_permissions));

CREATE POLICY contract_signers_insert ON public.contract_signers FOR INSERT TO authenticated
WITH CHECK (public.has_permission(auth.uid(), account_id, 'invoices.edit'::public.app_permissions));

CREATE POLICY contract_signers_update ON public.contract_signers FOR UPDATE TO authenticated
USING (public.has_permission(auth.uid(), account_id, 'invoices.edit'::public.app_permissions));

CREATE POLICY contract_signers_delete ON public.contract_signers FOR DELETE TO authenticated
USING (public.has_permission(auth.uid(), account_id, 'invoices.edit'::public.app_permissions));

DROP POLICY IF EXISTS contract_attachments_select ON public.contract_attachments;
DROP POLICY IF EXISTS contract_attachments_insert ON public.contract_attachments;
DROP POLICY IF EXISTS contract_attachments_update ON public.contract_attachments;
DROP POLICY IF EXISTS contract_attachments_delete ON public.contract_attachments;

CREATE POLICY contract_attachments_select ON public.contract_attachments FOR SELECT TO authenticated
USING (public.has_permission(auth.uid(), account_id, 'invoices.view'::public.app_permissions));

CREATE POLICY contract_attachments_insert ON public.contract_attachments FOR INSERT TO authenticated
WITH CHECK (public.has_permission(auth.uid(), account_id, 'invoices.edit'::public.app_permissions));

CREATE POLICY contract_attachments_update ON public.contract_attachments FOR UPDATE TO authenticated
USING (public.has_permission(auth.uid(), account_id, 'invoices.edit'::public.app_permissions));

CREATE POLICY contract_attachments_delete ON public.contract_attachments FOR DELETE TO authenticated
USING (public.has_permission(auth.uid(), account_id, 'invoices.edit'::public.app_permissions));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.contract_signers TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.contract_attachments TO authenticated;

NOTIFY pgrst, 'reload schema';
