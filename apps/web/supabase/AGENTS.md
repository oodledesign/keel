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
pnpm supabase:web:reset     # Reset database
pnpm supabase:web:typegen   # Generate TypeScript types
pnpm --filter web supabase migrations list  # View migrations
```
