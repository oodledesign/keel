-- Expose module schemas to PostgREST on hosted Supabase (mirrors supabase/config.toml [api].schemas).

ALTER ROLE authenticator SET
  pgrst.db_schemas = 'public, storage, graphql_public, feedflow, rankly, platform_merge, signatures';

NOTIFY pgrst, 'reload config';
NOTIFY pgrst, 'reload schema';
