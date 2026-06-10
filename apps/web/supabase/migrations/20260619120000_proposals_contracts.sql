-- Proposals, contracts, meeting transcripts for business workspaces

-- 1) meeting_transcripts
CREATE TABLE IF NOT EXISTS public.meeting_transcripts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.accounts (id) ON DELETE CASCADE,
  client_id uuid REFERENCES public.clients (id) ON DELETE CASCADE,
  deal_id uuid REFERENCES public.pipeline_deals (id) ON DELETE CASCADE,
  title text NOT NULL DEFAULT 'Meeting transcript',
  content text NOT NULL DEFAULT '',
  source text NOT NULL DEFAULT 'paste' CHECK (source IN ('paste', 'upload')),
  file_path text,
  created_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT meeting_transcripts_client_or_deal CHECK (
    client_id IS NOT NULL OR deal_id IS NOT NULL
  )
);

CREATE INDEX IF NOT EXISTS ix_meeting_transcripts_account_id
  ON public.meeting_transcripts (account_id);
CREATE INDEX IF NOT EXISTS ix_meeting_transcripts_client_id
  ON public.meeting_transcripts (client_id)
  WHERE client_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS ix_meeting_transcripts_deal_id
  ON public.meeting_transcripts (deal_id)
  WHERE deal_id IS NOT NULL;

DROP TRIGGER IF EXISTS meeting_transcripts_set_timestamps ON public.meeting_transcripts;
CREATE TRIGGER meeting_transcripts_set_timestamps
  BEFORE INSERT OR UPDATE ON public.meeting_transcripts
  FOR EACH ROW EXECUTE FUNCTION public.trigger_set_timestamps();

-- 2) contracts (before proposals.contract_id FK)
CREATE TABLE IF NOT EXISTS public.contracts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.accounts (id) ON DELETE CASCADE,
  client_id uuid REFERENCES public.clients (id) ON DELETE SET NULL,
  deal_id uuid REFERENCES public.pipeline_deals (id) ON DELETE SET NULL,
  proposal_id uuid,
  title text NOT NULL DEFAULT 'Agreement',
  content_html text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'draft' CHECK (
    status IN ('draft', 'ready_to_sign', 'sent', 'signed', 'cancelled')
  ),
  public_token text UNIQUE,
  total_pence integer NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'gbp',
  payment_plan jsonb NOT NULL DEFAULT '[]'::jsonb,
  auto_send_on_approval boolean NOT NULL DEFAULT false,
  author_type text CHECK (author_type IS NULL OR author_type IN ('individual', 'company')),
  author_name text,
  author_company text,
  author_signature_type text CHECK (
    author_signature_type IS NULL OR author_signature_type IN ('typed', 'drawn', 'uploaded')
  ),
  author_signature_data text,
  author_signed_at timestamptz,
  recipient_type text CHECK (recipient_type IS NULL OR recipient_type IN ('individual', 'company')),
  recipient_name text,
  recipient_company text,
  recipient_signature_type text CHECK (
    recipient_signature_type IS NULL OR recipient_signature_type IN ('typed', 'drawn', 'uploaded')
  ),
  recipient_signature_data text,
  recipient_signed_at timestamptz,
  recipient_email text,
  sent_to_email text,
  sent_at timestamptz,
  read_at timestamptz,
  invoices_generated_at timestamptz,
  email_subject text,
  email_body text,
  email_signature text,
  private_note text,
  created_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT contracts_client_or_deal CHECK (
    client_id IS NOT NULL OR deal_id IS NOT NULL
  )
);

CREATE INDEX IF NOT EXISTS ix_contracts_account_id_status
  ON public.contracts (account_id, status);
CREATE INDEX IF NOT EXISTS ix_contracts_public_token
  ON public.contracts (public_token)
  WHERE public_token IS NOT NULL;

DROP TRIGGER IF EXISTS contracts_set_timestamps ON public.contracts;
CREATE TRIGGER contracts_set_timestamps
  BEFORE INSERT OR UPDATE ON public.contracts
  FOR EACH ROW EXECUTE FUNCTION public.trigger_set_timestamps();

-- 3) proposals
CREATE TABLE IF NOT EXISTS public.proposals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.accounts (id) ON DELETE CASCADE,
  client_id uuid REFERENCES public.clients (id) ON DELETE SET NULL,
  deal_id uuid REFERENCES public.pipeline_deals (id) ON DELETE SET NULL,
  contract_id uuid REFERENCES public.contracts (id) ON DELETE SET NULL,
  title text NOT NULL DEFAULT 'Proposal',
  content_html text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'draft' CHECK (
    status IN ('draft', 'sent', 'read', 'approved', 'declined')
  ),
  public_token text UNIQUE,
  recipient_name text,
  recipient_email text,
  total_pence integer,
  currency text NOT NULL DEFAULT 'gbp',
  expires_at timestamptz,
  read_at timestamptz,
  approved_at timestamptz,
  declined_at timestamptz,
  sent_to_email text,
  sent_at timestamptz,
  email_subject text,
  email_body text,
  email_signature text,
  private_note text,
  created_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT proposals_client_or_deal CHECK (
    client_id IS NOT NULL OR deal_id IS NOT NULL
  )
);

ALTER TABLE public.contracts
  DROP CONSTRAINT IF EXISTS contracts_proposal_id_fkey;
ALTER TABLE public.contracts
  ADD CONSTRAINT contracts_proposal_id_fkey
  FOREIGN KEY (proposal_id) REFERENCES public.proposals (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS ix_proposals_account_id_status
  ON public.proposals (account_id, status);
CREATE INDEX IF NOT EXISTS ix_proposals_public_token
  ON public.proposals (public_token)
  WHERE public_token IS NOT NULL;

DROP TRIGGER IF EXISTS proposals_set_timestamps ON public.proposals;
CREATE TRIGGER proposals_set_timestamps
  BEFORE INSERT OR UPDATE ON public.proposals
  FOR EACH ROW EXECUTE FUNCTION public.trigger_set_timestamps();

-- 4) proposal_comments
CREATE TABLE IF NOT EXISTS public.proposal_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.accounts (id) ON DELETE CASCADE,
  proposal_id uuid NOT NULL REFERENCES public.proposals (id) ON DELETE CASCADE,
  author_id uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  author_name text,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_proposal_comments_proposal_id
  ON public.proposal_comments (proposal_id, created_at);

-- 5) audit events
CREATE TABLE IF NOT EXISTS public.proposal_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.accounts (id) ON DELETE CASCADE,
  proposal_id uuid NOT NULL REFERENCES public.proposals (id) ON DELETE CASCADE,
  event_type text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  actor_id uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_proposal_events_proposal_id
  ON public.proposal_events (proposal_id, created_at);

CREATE TABLE IF NOT EXISTS public.contract_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.accounts (id) ON DELETE CASCADE,
  contract_id uuid NOT NULL REFERENCES public.contracts (id) ON DELETE CASCADE,
  event_type text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  actor_id uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_contract_events_contract_id
  ON public.contract_events (contract_id, created_at);

-- 6) RLS (reuse invoices.view / invoices.edit)
ALTER TABLE public.meeting_transcripts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.proposals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.proposal_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.proposal_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contract_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS meeting_transcripts_select ON public.meeting_transcripts;
DROP POLICY IF EXISTS meeting_transcripts_insert ON public.meeting_transcripts;
DROP POLICY IF EXISTS meeting_transcripts_update ON public.meeting_transcripts;
DROP POLICY IF EXISTS meeting_transcripts_delete ON public.meeting_transcripts;

CREATE POLICY meeting_transcripts_select ON public.meeting_transcripts FOR SELECT TO authenticated
USING (public.has_permission(auth.uid(), account_id, 'invoices.view'::public.app_permissions));

CREATE POLICY meeting_transcripts_insert ON public.meeting_transcripts FOR INSERT TO authenticated
WITH CHECK (public.has_permission(auth.uid(), account_id, 'invoices.edit'::public.app_permissions));

CREATE POLICY meeting_transcripts_update ON public.meeting_transcripts FOR UPDATE TO authenticated
USING (public.has_permission(auth.uid(), account_id, 'invoices.edit'::public.app_permissions));

CREATE POLICY meeting_transcripts_delete ON public.meeting_transcripts FOR DELETE TO authenticated
USING (public.has_permission(auth.uid(), account_id, 'invoices.edit'::public.app_permissions));

DROP POLICY IF EXISTS proposals_select ON public.proposals;
DROP POLICY IF EXISTS proposals_insert ON public.proposals;
DROP POLICY IF EXISTS proposals_update ON public.proposals;
DROP POLICY IF EXISTS proposals_delete ON public.proposals;

CREATE POLICY proposals_select ON public.proposals FOR SELECT TO authenticated
USING (public.has_permission(auth.uid(), account_id, 'invoices.view'::public.app_permissions));

CREATE POLICY proposals_insert ON public.proposals FOR INSERT TO authenticated
WITH CHECK (public.has_permission(auth.uid(), account_id, 'invoices.edit'::public.app_permissions));

CREATE POLICY proposals_update ON public.proposals FOR UPDATE TO authenticated
USING (public.has_permission(auth.uid(), account_id, 'invoices.edit'::public.app_permissions));

CREATE POLICY proposals_delete ON public.proposals FOR DELETE TO authenticated
USING (public.has_permission(auth.uid(), account_id, 'invoices.edit'::public.app_permissions));

DROP POLICY IF EXISTS proposal_comments_select ON public.proposal_comments;
DROP POLICY IF EXISTS proposal_comments_insert ON public.proposal_comments;

CREATE POLICY proposal_comments_select ON public.proposal_comments FOR SELECT TO authenticated
USING (public.has_permission(auth.uid(), account_id, 'invoices.view'::public.app_permissions));

CREATE POLICY proposal_comments_insert ON public.proposal_comments FOR INSERT TO authenticated
WITH CHECK (public.has_permission(auth.uid(), account_id, 'invoices.edit'::public.app_permissions));

DROP POLICY IF EXISTS proposal_events_select ON public.proposal_events;
DROP POLICY IF EXISTS proposal_events_insert ON public.proposal_events;

CREATE POLICY proposal_events_select ON public.proposal_events FOR SELECT TO authenticated
USING (public.has_permission(auth.uid(), account_id, 'invoices.view'::public.app_permissions));

CREATE POLICY proposal_events_insert ON public.proposal_events FOR INSERT TO authenticated
WITH CHECK (public.has_permission(auth.uid(), account_id, 'invoices.edit'::public.app_permissions));

DROP POLICY IF EXISTS contracts_select ON public.contracts;
DROP POLICY IF EXISTS contracts_insert ON public.contracts;
DROP POLICY IF EXISTS contracts_update ON public.contracts;
DROP POLICY IF EXISTS contracts_delete ON public.contracts;

CREATE POLICY contracts_select ON public.contracts FOR SELECT TO authenticated
USING (public.has_permission(auth.uid(), account_id, 'invoices.view'::public.app_permissions));

CREATE POLICY contracts_insert ON public.contracts FOR INSERT TO authenticated
WITH CHECK (public.has_permission(auth.uid(), account_id, 'invoices.edit'::public.app_permissions));

CREATE POLICY contracts_update ON public.contracts FOR UPDATE TO authenticated
USING (public.has_permission(auth.uid(), account_id, 'invoices.edit'::public.app_permissions));

CREATE POLICY contracts_delete ON public.contracts FOR DELETE TO authenticated
USING (public.has_permission(auth.uid(), account_id, 'invoices.edit'::public.app_permissions));

DROP POLICY IF EXISTS contract_events_select ON public.contract_events;
DROP POLICY IF EXISTS contract_events_insert ON public.contract_events;

CREATE POLICY contract_events_select ON public.contract_events FOR SELECT TO authenticated
USING (public.has_permission(auth.uid(), account_id, 'invoices.view'::public.app_permissions));

CREATE POLICY contract_events_insert ON public.contract_events FOR INSERT TO authenticated
WITH CHECK (public.has_permission(auth.uid(), account_id, 'invoices.edit'::public.app_permissions));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.meeting_transcripts TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.proposals TO authenticated;
GRANT SELECT, INSERT ON public.proposal_comments TO authenticated;
GRANT SELECT, INSERT ON public.proposal_events TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.contracts TO authenticated;
GRANT SELECT, INSERT ON public.contract_events TO authenticated;
