-- Self-serve custom sending domains (Amazon SES identity + tenant per workspace).
-- Applied by Dan with psql — do not supabase db push.

CREATE TABLE IF NOT EXISTS public.account_sending_domains (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL UNIQUE REFERENCES public.accounts (id) ON DELETE CASCADE,
  domain text NOT NULL,
  mail_from_subdomain text NOT NULL DEFAULT 'bounce',
  default_local_part text NOT NULL DEFAULT 'listings',
  ses_identity_name text,
  ses_identity_arn text,
  ses_tenant_name text,
  ses_configuration_set text,
  dkim_tokens jsonb NOT NULL DEFAULT '[]'::jsonb,
  dns_records jsonb NOT NULL DEFAULT '[]'::jsonb,
  dkim_status text NOT NULL DEFAULT 'pending',
  mail_from_status text NOT NULL DEFAULT 'pending',
  verification_status text NOT NULL DEFAULT 'pending',
  verified_at timestamptz,
  created_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT account_sending_domains_domain_format CHECK (
    domain ~ '^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)+$'
    AND position('@' IN domain) = 0
  ),
  CONSTRAINT account_sending_domains_mail_from_format CHECK (
    mail_from_subdomain ~ '^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$'
  ),
  CONSTRAINT account_sending_domains_local_part_format CHECK (
    default_local_part ~ '^[a-z0-9]([a-z0-9._-]{0,62}[a-z0-9])?$'
  ),
  CONSTRAINT account_sending_domains_dkim_status CHECK (
    dkim_status IN (
      'pending',
      'success',
      'failed',
      'temporary_failure',
      'not_started'
    )
  ),
  CONSTRAINT account_sending_domains_mail_from_status CHECK (
    mail_from_status IN (
      'pending',
      'success',
      'failed',
      'temporary_failure',
      'not_started'
    )
  ),
  CONSTRAINT account_sending_domains_verification_status CHECK (
    verification_status IN ('pending', 'verified', 'failed')
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS account_sending_domains_domain_uidx
  ON public.account_sending_domains (domain);

COMMENT ON TABLE public.account_sending_domains IS
  'Workspace custom sending domain (SES identity + tenant). One active domain per account; domain is globally unique.';

COMMENT ON COLUMN public.account_sending_domains.domain IS
  'Normalized apex/sending domain (lowercase, no protocol or www), e.g. bracketts.co.uk';

COMMENT ON COLUMN public.account_sending_domains.mail_from_subdomain IS
  'Relative MAIL FROM host, typically bounce (bounce.example.com)';

COMMENT ON COLUMN public.account_sending_domains.default_local_part IS
  'Default From local-part, e.g. listings → listings@domain';

COMMENT ON COLUMN public.account_sending_domains.ses_tenant_name IS
  'SES tenant name, typically ozer-account-<account uuid>';

COMMENT ON COLUMN public.account_sending_domains.dns_records IS
  'Copyable DNS records: [{type, host, name, value, purpose, priority?}]';

DROP TRIGGER IF EXISTS account_sending_domains_set_timestamps
  ON public.account_sending_domains;
CREATE TRIGGER account_sending_domains_set_timestamps
  BEFORE UPDATE ON public.account_sending_domains
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_set_timestamps();

ALTER TABLE public.account_sending_domains ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.account_sending_domains
  TO authenticated, service_role;

DROP POLICY IF EXISTS account_sending_domains_select ON public.account_sending_domains;
CREATE POLICY account_sending_domains_select ON public.account_sending_domains
  FOR SELECT TO authenticated
  USING (public.has_role_on_account (account_id));

DROP POLICY IF EXISTS account_sending_domains_insert ON public.account_sending_domains;
CREATE POLICY account_sending_domains_insert ON public.account_sending_domains
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.accounts_memberships am
      WHERE am.account_id = account_sending_domains.account_id
        AND am.user_id = auth.uid ()
        AND am.account_role IN ('owner', 'admin')
    )
  );

DROP POLICY IF EXISTS account_sending_domains_update ON public.account_sending_domains;
CREATE POLICY account_sending_domains_update ON public.account_sending_domains
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.accounts_memberships am
      WHERE am.account_id = account_sending_domains.account_id
        AND am.user_id = auth.uid ()
        AND am.account_role IN ('owner', 'admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.accounts_memberships am
      WHERE am.account_id = account_sending_domains.account_id
        AND am.user_id = auth.uid ()
        AND am.account_role IN ('owner', 'admin')
    )
  );

DROP POLICY IF EXISTS account_sending_domains_delete ON public.account_sending_domains;
CREATE POLICY account_sending_domains_delete ON public.account_sending_domains
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.accounts_memberships am
      WHERE am.account_id = account_sending_domains.account_id
        AND am.user_id = auth.uid ()
        AND am.account_role IN ('owner', 'admin')
    )
  );

NOTIFY pgrst, 'reload schema';
