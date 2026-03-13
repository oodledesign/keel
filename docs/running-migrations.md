# Running Supabase migrations

Migrations live in `apps/web/supabase/migrations/`. How you run them depends on whether you use **local Supabase** or **Supabase Cloud** (hosted).

---

## Why does `supabase start` download ~1GB?

The first time you run `supabase start`, the CLI pulls **Docker images** for the whole stack (Postgres, GoTrue, PostgREST, Realtime, Studio, Storage, etc.). That’s usually **one-time**: Docker caches the images, so the next `supabase start` should only start containers, not re-download.

You’ll see another large download if:
- You run `docker system prune` (or similar) and remove unused images
- You update the Supabase CLI and it uses new image versions
- You’re on a new machine or a fresh CI run

**To use fewer services and reduce download/startup:**

From `apps/web` you can exclude services you don’t need. For example, to skip Realtime, Studio, imgproxy, and analytics:

```bash
cd apps/web
supabase start --exclude realtime,studio,imgproxy,logflare
```

Excludable services (see `supabase start --help`): `gotrue`, `realtime`, `storage-api`, `imgproxy`, `kong`, `mailpit`, `postgrest`, `postgres-meta`, `studio`, `edge-runtime`, `logflare`, `vector`, `supavisor`. Don’t exclude `postgrest` or auth if your app needs the API or login. **Note:** Some CLI versions still pull images for excluded services; excluding mainly reduces what *runs*, and can still reduce total download in practice.

---

## Option A: Supabase CLI (recommended)

### Local Supabase (e.g. `supabase start`)

From the **repo root**:

```bash
pnpm supabase:web:reset
```

Or from `apps/web`:

```bash
pnpm supabase:reset
```

This **resets the local database** and reapplies all migrations (including the one that adds the Contractor role). Use this when you’re fine wiping local data.

To apply new migrations **without** wiping data: start Supabase, then run:

```bash

cd keel/apps/web && supabase db push

cd apps/web
supabase migration up
```

(Push applies pending migrations to the **linked** project; for a purely local DB, reset is the usual way to get a clean state with all migrations.)

### Supabase Cloud (hosted project)

1. **Link** the app to your project (one-time, if not already done):

   ```bash
   cd apps/web
   supabase link --project-ref YOUR_PROJECT_REF
   ```

   `YOUR_PROJECT_REF` is in the Supabase dashboard: Project Settings → General → Reference ID.

2. **Push** migrations to the linked project:

   ```bash
   cd apps/web
   supabase db push
   ```

   Or from the repo root using the script (requires `SUPABASE_PROJECT_REF` in the env):

   ```bash
   SUPABASE_PROJECT_REF=your_ref pnpm --filter web supabase:deploy
   ```

That applies all pending migrations (including the Contractor role) to your hosted DB.

### After migrations: regenerate TypeScript types

If you add or change tables/columns (e.g. `user_settings`, new `accounts_memberships` columns), regenerate the Supabase types so the app and `tsc` stay in sync:

**From local DB** (with Supabase running and migrations applied, e.g. after `supabase db reset` or `supabase db push` locally):

```bash
cd apps/web
pnpm run supabase:typegen
```

This updates `packages/supabase/src/database.types.ts` and `apps/web/lib/database.types.ts`. Commit the updated types so typecheck and IDE stay correct.

**From a linked remote project** (e.g. staging): link first, then run the same command; the CLI will use the linked project’s schema if you’re not using `--local`. (Some setups use `supabase gen types typescript --linked` and redirect output to the same paths; adjust if your script differs.)

---

## Option B: Run SQL manually (e.g. only the Contractor migration)

If you prefer not to use the CLI, you can run the migration SQL in the **Supabase Dashboard**:

1. Open your project → **SQL Editor**.
2. Run the contents of the migration file(s) you need.

To add **only the Contractor role** and its permissions, run the SQL from:

- `apps/web/supabase/migrations/20260216000001_contractor_role_and_clients_view.sql`

That file:

- Inserts the `contractor` role (hierarchy_level 30).
- Adds permissions: `projects.view`, `projects.edit`, `clients.view` for contractor; `clients.edit` for owner, admin, staff.

If you also use **projects** and **clients** tables and RLS, run the next migration as well:

- `apps/web/supabase/migrations/20260216000002_projects_clients_assignments.sql`

After that, the **Contractor** option will appear in the Members invite role dropdown (and in the permission matrix).
