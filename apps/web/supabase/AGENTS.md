# Supabase Database

## Schema Organization

Schemas in `schemas/` directory with numbered prefixes for dependency ordering.

## Skills

For database implementation:
- `/postgres-expert` - Schema design, RLS, migrations, testing

## Migration Workflow

### New Entities

```bash
# Create schema file
touch schemas/20-feature.sql

# Create migration
pnpm --filter web run supabase migrations new feature_name

# Copy content, apply, generate types
pnpm --filter web supabase migrations up
pnpm supabase:web:typegen
```

### Modify Existing

```bash
# Edit schema, generate diff
pnpm --filter web run supabase:db:diff -f update_feature

# Apply and regenerate
pnpm --filter web supabase migrations up
pnpm supabase:web:typegen
```

## Security Rules

- **ALWAYS enable RLS** on new tables
- **NEVER use SECURITY DEFINER** without explicit access controls
- Use existing helper functions (see `/postgres-expert` skill)

## Table Template

```sql
create table if not exists public.feature (
  id uuid unique not null default extensions.uuid_generate_v4(),
  account_id uuid references public.accounts(id) on delete cascade not null,
  created_at timestamp with time zone default now(),
  primary key (id)
);

alter table "public"."feature" enable row level security;
revoke all on public.feature from authenticated, service_role;
grant select, insert, update, delete on table public.feature to authenticated;

-- Use helper functions for policies
create policy "feature_read" on public.feature for select
  to authenticated using (
    account_id = (select auth.uid()) or
    public.has_role_on_account(account_id)
  );
```

## Commands

```bash
# From monorepo root (keel/):
pnpm supabase:web:reset     # Reset database
pnpm supabase:web:fresh     # Stop, drop volumes (no backup), start clean
pnpm supabase:web:typegen   # Generate TypeScript types
pnpm supabase:web:exec migration list   # Any CLI subcommand (cwd = apps/web)

# From apps/web/ (pnpm supabase:web:* matches monorepo root naming):
pnpm supabase:web:start
pnpm supabase:fresh
pnpm supabase:web:fresh     # same as supabase:fresh
```

## Local Docker troubleshooting

**`open supabase/.temp/profile: no such file or directory`**  
You ran the Supabase CLI from the **monorepo root** (`keel/`), but this project’s `supabase/` directory lives under **`apps/web/`**. The CLI then mis-resolves paths and Docker state can look inconsistent. Fix: either **`cd apps/web`** before `supabase …`, or from the repo root run **`pnpm supabase:web:exec <subcommand> …`** (for example `pnpm supabase:web:exec start --exclude realtime --debug`). Prefer **`pnpm supabase:web:start`** / **`pnpm supabase:web:fresh`** so the workdir is always correct.

**PostgREST: schema "feedflow" does not exist (or rankly / platform_merge)**  
The local Postgres volume was restored from backup without those schemas, while `config.toml` already exposes them. Prefer **`pnpm supabase:web:fresh`** from the monorepo root (`supabase stop --no-backup` then `supabase start --exclude realtime`), which reapplies migrations on a clean volume. Alternatively: `supabase stop`, `docker volume rm supabase_db_keel`, then `pnpm supabase:web:start`. Avoid chaining `supabase stop` (default backup) and an immediate manual `volume rm` unless you mean to discard that backup—use `stop --no-backup` for a predictable wipe.

**`error running container: exit 255` during "Initialising schema"**  
Docker or Postgres aborted during init (often transient: disk pressure, Docker Desktop glitch, or a bad image layer). Retry once; run `supabase start --exclude realtime --debug` from `apps/web` for the real stderr; free disk space and `docker system prune` if needed; restart Docker Desktop; upgrade the Supabase CLI toward the version the CLI prints in its update notice.

**Realtime: `exec /usr/bin/tini: exec format error`**  
Usually a wrong-architecture image or a bad layer pull on Apple Silicon. Default `pnpm supabase:web:start` runs `supabase start --exclude realtime` so the rest of the stack can run. For Realtime locally, use `pnpm supabase:web:start:full` after upgrading the Supabase CLI and Docker Desktop, then `docker rmi` the realtime image and pull again, or see Supabase CLI release notes.

**`supabase db reset` → "supabase start is not running"**  
The CLI expects the local stack up first. Start successfully (possibly without Realtime as above), then run `pnpm supabase:web:reset` from the repo root.

**Chaining stop and start**  
Use shell syntax, not the word `then`. Example: `supabase stop --no-backup && supabase start --exclude realtime` or put them on two lines. Otherwise flags like `--exclude` are parsed as arguments to `supabase stop` and you see `unknown flag: --exclude`.
