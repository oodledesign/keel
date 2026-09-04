-- Opaque public token for read-only DNS instructions share page.
-- Applied by Dan with psql — do not supabase db push.
-- Load via service role by token only; no anon RLS policy.

ALTER TABLE public.account_sending_domains
  ADD COLUMN IF NOT EXISTS instructions_share_token text;

UPDATE public.account_sending_domains
SET instructions_share_token = encode(gen_random_bytes(24), 'hex')
WHERE instructions_share_token IS NULL;

ALTER TABLE public.account_sending_domains
  ALTER COLUMN instructions_share_token SET DEFAULT encode(gen_random_bytes(24), 'hex');

ALTER TABLE public.account_sending_domains
  ALTER COLUMN instructions_share_token SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS account_sending_domains_instructions_share_token_uidx
  ON public.account_sending_domains (instructions_share_token);

COMMENT ON COLUMN public.account_sending_domains.instructions_share_token IS
  'Opaque public token for the DNS instructions share page; no anon RLS — load via service role by token only.';

NOTIFY pgrst, 'reload schema';
