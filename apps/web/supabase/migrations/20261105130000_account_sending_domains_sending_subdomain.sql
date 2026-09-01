-- Sending subdomain (default mail) on workspace custom sending domains.
-- Applied by Dan with psql — do not supabase db push.
--
-- sending_subdomain null/empty = send from the apex (mail@bracketts.co.uk).
-- Default for new rows is 'mail' so identity is mail.bracketts.co.uk.
-- Existing rows stay NULL so already-verified apex identities are unchanged.

ALTER TABLE public.account_sending_domains
  ADD COLUMN IF NOT EXISTS sending_subdomain text;

ALTER TABLE public.account_sending_domains
  ALTER COLUMN sending_subdomain SET DEFAULT 'mail';

ALTER TABLE public.account_sending_domains
  ALTER COLUMN default_local_part SET DEFAULT 'mail';

ALTER TABLE public.account_sending_domains
  DROP CONSTRAINT IF EXISTS account_sending_domains_sending_subdomain_format;

ALTER TABLE public.account_sending_domains
  ADD CONSTRAINT account_sending_domains_sending_subdomain_format CHECK (
    sending_subdomain IS NULL
    OR btrim(sending_subdomain) = ''
    OR sending_subdomain ~ '^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$'
  );

ALTER TABLE public.account_sending_domains
  ADD COLUMN IF NOT EXISTS sending_host text
  GENERATED ALWAYS AS (
    CASE
      WHEN sending_subdomain IS NULL
        OR btrim(sending_subdomain) = '' THEN domain
      ELSE btrim(sending_subdomain) || '.' || domain
    END
  ) STORED;

CREATE UNIQUE INDEX IF NOT EXISTS account_sending_domains_sending_host_uidx
  ON public.account_sending_domains (sending_host);

COMMENT ON COLUMN public.account_sending_domains.sending_subdomain IS
  'Sending host label under the apex (default mail). Null or empty = send from the apex.';

COMMENT ON COLUMN public.account_sending_domains.sending_host IS
  'Resolved SES identity / From host: {subdomain}.{apex} or the apex when sending_subdomain is empty.';

COMMENT ON COLUMN public.account_sending_domains.domain IS
  'Normalized apex domain (lowercase, no protocol or www), e.g. bracketts.co.uk. Globally unique.';

COMMENT ON COLUMN public.account_sending_domains.mail_from_subdomain IS
  'MAIL FROM label relative to the sending host, typically bounce (bounce.mail.example.com).';

COMMENT ON COLUMN public.account_sending_domains.default_local_part IS
  'Default From local-part, e.g. mail → mail@mail.example.com';

COMMENT ON TABLE public.account_sending_domains IS
  'Workspace custom sending domain (SES identity + tenant). One active domain per account; apex and resolved sending host are globally unique.';

NOTIFY pgrst, 'reload schema';
