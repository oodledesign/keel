-- Link an Ozer workspace account to a provider client_org for partner support.

ALTER TABLE public.client_orgs
  ADD COLUMN IF NOT EXISTS linked_account_id uuid REFERENCES public.accounts (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS ix_client_orgs_linked_account_id
  ON public.client_orgs (linked_account_id)
  WHERE linked_account_id IS NOT NULL;

COMMENT ON COLUMN public.client_orgs.linked_account_id IS
  'Ozer workspace account that may submit partner-support tickets for this client_org (provider-scoped).';

NOTIFY pgrst, 'reload schema';
