-- Speed up desktop recorder token lookups during auth (active tokens only).

CREATE INDEX IF NOT EXISTS ix_api_tokens_active_token_hash
  ON public.api_tokens (token_hash)
  WHERE revoked_at IS NULL;

COMMENT ON INDEX public.ix_api_tokens_active_token_hash IS
  'Partial index for recorder Bearer token validation (revoked_at IS NULL filter).';
