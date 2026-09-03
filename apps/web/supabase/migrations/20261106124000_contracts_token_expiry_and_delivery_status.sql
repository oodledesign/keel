-- Contracts phase 1 hardening: public token expiry/revocation and explicit
-- email delivery status. Additive only, no destructive changes.
--
-- public_token_expires_at / public_token_revoked_at follow the same
-- expires_at / revoked_at naming used elsewhere for token-gated public links
-- (see signatures.preview_shares, api_tokens). NULL means "not set" (no
-- expiry / never revoked); portal and PDF access must treat an expired or
-- revoked token the same as a missing one.
--
-- email_delivery_status / email_delivery_error record whether the most
-- recent attempt to email the contract to its recipient actually succeeded,
-- so the UI never shows a contract as "sent" when delivery failed silently.

ALTER TABLE public.contracts
  ADD COLUMN IF NOT EXISTS public_token_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS public_token_revoked_at timestamptz,
  ADD COLUMN IF NOT EXISTS email_delivery_status text,
  ADD COLUMN IF NOT EXISTS email_delivery_error text;

ALTER TABLE public.contracts
  DROP CONSTRAINT IF EXISTS contracts_email_delivery_status_check;
ALTER TABLE public.contracts
  ADD CONSTRAINT contracts_email_delivery_status_check CHECK (
    email_delivery_status IS NULL OR email_delivery_status IN ('sent', 'failed')
  );

COMMENT ON COLUMN public.contracts.public_token_expires_at IS
  'Optional expiry for public_token. NULL means no expiry. Portal/PDF access must reject expired tokens.';

COMMENT ON COLUMN public.contracts.public_token_revoked_at IS
  'Set when an owner/admin revokes the shareable link. NULL means the link (if any) is still active. Portal/PDF access must reject revoked tokens.';

COMMENT ON COLUMN public.contracts.email_delivery_status IS
  'Outcome of the most recent attempt to email this contract to its recipient: sent | failed. NULL if no email has been attempted yet.';

COMMENT ON COLUMN public.contracts.email_delivery_error IS
  'Human-readable error from the most recent failed email delivery attempt. Cleared on the next successful send.';

NOTIFY pgrst, 'reload schema';
