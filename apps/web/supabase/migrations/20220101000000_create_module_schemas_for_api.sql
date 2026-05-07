-- PostgREST reads `api.schemas` from config.toml at startup. These schemas must exist
-- in the database before any service loads the schema cache (runs before all other migrations).
create schema if not exists feedflow;
create schema if not exists rankly;
create schema if not exists platform_merge;
