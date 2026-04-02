# Supabase diagnostics

## Error: `Could not find the function public.create_team_account(...)` (PGRST202)

The app calls **`create_team_account(text, uuid, text)`** using the **service role**. If migration history was repaired without running SQL, you may still have only the legacy **`create_team_account(text)`** overload (PostgREST may hint: *Perhaps you meant … (account_name)* only).

1. In **SQL Editor**, run **`ensure-create-team-account-rpc.sql`** (this folder).
2. If the `INSERT` into `accounts_memberships` fails with **missing `company_role` / `onboarding_*` columns**, run migration **`20260329123000_accounts_memberships_onboarding_columns.sql`** (`supabase db push`) or paste that file in SQL Editor. Alternatively apply the full `20260212000002_onboarding_schema_memberships_invitations.sql` (invitations + triggers + `accept_invitation`).

---

## Error: `Could not find the table 'public.user_settings' in the schema cache`

PostgREST (Supabase Data API) only exposes tables that exist in your database. This error means **`public.user_settings` was never created** on the project your app points to — for example if you used **`bootstrap-teams-only.sql`** only, or skipped migrations that add `user_settings`.

### Fix A — one-shot SQL (quick)

1. Supabase Dashboard → **SQL Editor**.
2. Run **`ensure-user-settings.sql`** (in this folder).

Then retry **Save preferences** in the app. If the error persists, wait a minute or in **Project Settings → API** use **Reload schema** (if available).

### Fix B — migrations (recommended long-term)

From `apps/web`, link and push so all migrations apply:

```bash
supabase link --project-ref YOUR_PROJECT_REF
supabase db push
```

That includes `20260212000003_user_settings_table.sql` and later `user_settings` column changes.

### Drift: history says “up to date” but `jobs` / `invoices` 404

If you used `migration repair` without running SQL, **`db push` will not re-run** old versions. Apply the one-shot repair migration:

- **`20260329140000_repair_jobs_invoices_schema_drift.sql`** (under `supabase/migrations/`) — idempotent jobs + invoices tables, RLS, RPCs.

Then `supabase db push` once so it is recorded on the remote.

---

## Error: `relation "public.accounts" does not exist`

Your database is missing the **base schema** for teams. The `public.accounts` table (and team accounts, memberships, etc.) is normally created in the first migration: `20221215192558_schema.sql`.

### Fix 1: Minimal bootstrap (no full migration stack)

If you **do not** want to run the full migration stack (e.g. to avoid touching existing Tradeways/other schema):

1. Answer **No** when Supabase asks to push migrations (so nothing is applied).
2. In Supabase Dashboard → **SQL Editor**, open and run the script:
   - **`bootstrap-teams-only.sql`**

That script creates only what’s needed for teams to work: `config`, `roles`, `accounts`, `accounts_memberships`, RLS, and the `user_accounts` view. It does **not** create invitations, subscriptions, billing, etc. It’s idempotent (safe to run more than once).

After running it, create teams in the app (“Create a team”) or insert rows into `accounts` and `accounts_memberships` (see comments at the bottom of the script).

### Fix 2: Apply all migrations

Use this only if you’re okay applying the full Keel/Makerkit migration history.

**Remote Supabase**

1. Link: `cd apps/web && supabase link --project-ref YOUR_PROJECT_REF`
2. Push: `supabase db push`  
   (answer **Yes** when prompted)

**Local Supabase**

From repo root: `pnpm supabase:web:reset`

---

## Future: adding invites, billing, etc.

You already have `accounts`, `accounts_memberships`, `config`, `roles`, and other tables. When you want **invitations**, **billing** (Stripe/subscriptions), and the rest of the Keel/Makerkit stack, you have two options.

### Option A: Run the full migration stack (recommended when you’re ready)

1. **Back up your database** (Supabase Dashboard → Database → Backups, or a dump).
2. Link and push:
   ```bash
   cd apps/web && supabase link --project-ref YOUR_REF && supabase db push
   ```
   Answer **Yes** when prompted.

Migrations are mostly additive (`CREATE TABLE IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS`, `CREATE OR REPLACE FUNCTION`). Supabase only runs migrations that haven’t been applied yet, so you get:

- **Invitations**: `invitations` table, `accept_invitation`, `add_invitations_to_account`, RLS (from the base schema and later migrations).
- **Billing**: `billing_customers`, `subscriptions`, `subscription_items`, webhook handlers, RLS.
- **Role permissions**: `role_permissions`, `has_permission`, and any new roles/permissions.

If a migration fails (e.g. a table or column already exists with a different shape), fix that migration or adjust your data, then run `db push` again. Your existing tables (`businesses`, `pipeline_deals`, `groups`, etc.) are not modified by these migrations.

### Option B: Add features incrementally

If you prefer not to run the full stack, you can add only what you need by adding **new** migration files that create the missing pieces (e.g. `invitations`, `billing_customers`, `subscriptions`) using `IF NOT EXISTS` and the same definitions as in `20221215192558_schema.sql` (and related migrations). That keeps your current structure untouched and only adds new objects. More manual work, but full control.

**Rough map (for reference):**

| Feature        | Main migration(s) |
|----------------|--------------------|
| Invitations    | `20221215192558_schema.sql` (invitations table, RLS, `accept_invitation`), `20260212000002_*`, `20260107093634_*`, `20260224000002_*` |
| Billing (Stripe) | `20221215192558_schema.sql` (billing_customers, subscriptions, subscription_items, RLS), `20250917024249_triggers.sql`, plus app config / webhooks |
| Role permissions | `20221215192558_schema.sql` (role_permissions, has_permission), `20260212000001_*`, `20260212000005_*` |
