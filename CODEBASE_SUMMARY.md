# Keel — codebase reference for new modules

> **Generated for internal use.** Summarises the current Keel monorepo: database (from `apps/web/supabase/migrations`), web app layout, packages, auth/tenancy, and UI/design system. **Source of truth for schema details remains the SQL migrations**; this file can drift if migrations change.

---

## Conventions in this document

- **Path prefix:** `apps/web/` is the Next.js app unless stated otherwise.
- **No `apps/web/src`:** The App Router and app code live under `apps/web/app/`, not under a `src/` directory.
- **Supabase:** User identity is **Supabase Auth** (`auth.users`). Multi-tenant data is scoped by **`public.accounts`** and **`public.accounts_memberships`**.

---

## 1. Database: migrations and schema inventory

Migrations live in **`apps/web/supabase/migrations/`** (50 SQL files, ordered by timestamp). Early runs establish Makerkit-style **`public`** tables and helpers; later migrations add Keel CRM/jobs/invoices and **`feedflow`** / **`rankly`** / **`platform_merge`** schemas.

### 1.1 Schemas

| Schema | Purpose |
|--------|---------|
| **`public`** | Core tenancy (Makerkit), Keel CRM/work tables, config, billing linkage |
| **`feedflow`** | Social feeds, widgets, Google/Webflow/Bunny integrations |
| **`rankly`** | SEO/rank tracking projects, keywords, rankings, backlinks, alerts |
| **`platform_merge`** | Id mapping and sync/drift tooling for legacy migrations |
| **`kit`** | Helpers (e.g. `unaccent`) — private to DB |
| **`auth`** | Supabase Auth (managed) |
| **`storage`** | Supabase Storage buckets/policies |

**PostgREST / API:** Custom API schemas must exist in DB **before** PostgREST loads; see `20220101000000_create_module_schemas_for_api.sql` (`feedflow`, `rankly`, `platform_merge`). Host **`supabase/config.toml`** must list these schemas for REST (`api.schemas`) so clients can call `.schema('feedflow')` / `.schema('rankly')`.

### 1.2 Helper functions (selected)

Defined across migrations; heavily used by RLS:

- **`public.is_account_member(target_account_id uuid)`** — true if `auth.uid()` is in `accounts_memberships` for that account (`20260430165500`).
- **`public.is_account_admin(target_account_id uuid)`** — member with `account_role` in `owner` / `admin` (`20260430165500`).
- **`public.has_role_on_account(account_id)`**, **`public.has_permission(...)`**, **`public.get_config()`**, **`public.is_set(field)`** — Makerkit (`20221215192558_schema.sql` and follow-ups).
- **`public.is_super_admin()`** — used for `platform_merge` RLS (`20260430170500`) and MFA/super-admin policies (`20250302043537_mfa-rls-super-admin.sql`).
- **`public.handle_platform_profile_create`** — trigger on `auth.users` to upsert **`public.profiles`** (`20260430165500`).

### 1.3 `public` tables (core + Keel)

**Makerkit / platform (from `20221215192558_schema.sql` and seeds):**

| Table | Role |
|-------|------|
| **`config`** | Singleton flags: team accounts, billing toggles, `billing_provider` |
| **`accounts`** | Tenant/workspace: `id`, `primary_owner_user_id`, `name`, `slug`, `is_personal_account`, `picture_url`, `public_data`, timestamps. **`space_type`** added in `20260329160000` (`work` \| `family` \| `community` for non-personal accounts). |
| **`accounts_memberships`** | `(user_id, account_id)` PK, `account_role` → **`roles`**, audit columns |
| **`roles`** | Named roles + `hierarchy_level` |
| **`role_permissions`** | Maps roles → **`app_permissions`** enum (`roles.manage`, `billing.manage`, etc.) |
| **`invitations`** | Team invites (email, token, role, expiry) |
| **`billing_customers`** | Links Stripe (etc.) customer to `account_id` |
| **`subscriptions`**, **`subscription_items`** | Subscription billing mirror |
| **`orders`**, **`order_items`** | One-off payment orders |
| **`notifications`** | In-app notifications per account |
| **`nonces`** | One-time tokens (`20250301095452_one-time-tokens.sql`) |

**Keel product (additional migrations):**

| Table | Notes |
|-------|--------|
| **`user_settings`** | Per-user prefs; Keel context flags `use_keel_for_work|family|community` (`20260327150000`) |
| **`account_module_settings`** | PK `(account_id, module_key)`, `enabled` — feature flags per account (`20260329160000`) |
| **`clients`** | CRM clients per `account_id`; picture/name fields evolved in multiple migrations |
| **`client_notes`** | Notes on clients |
| **`projects`**, **`project_assignments`** | Project model + user assignment (not Rankly — **public** CRM projects) |
| **`jobs`**, **`job_assignments`**, **`job_notes`** | Job workflow |
| **`job_events`**, **`job_event_assignments`** | Scheduling/calendar-style events |
| **`invoice_counters`**, **`invoices`**, **`invoice_items`**, **`invoice_events`** | Invoicing |

**Unified profile:**

| Table | Columns (high level) |
|-------|----------------------|
| **`profiles`** | `id` → `auth.users`, `email`, `full_name`, `avatar_url`, timestamps (`20260430165500`) |

**RLS patterns (public):**

- **Accounts / memberships / invitations:** Role-scoped; “self” vs “team member” reads via `has_role_on_account`, `has_permission`, etc. (see base schema).
- **Clients, projects, jobs, invoices, job_events:** Authenticated policies with membership and sometimes contractor-specific rules (e.g. `20260311134500`, `20260216000006_jobs_rls.sql`, `20260228120002_invoices_rls.sql`, `20260329140000_repair_jobs_invoices_schema_drift.sql`).
- **`account_module_settings`:** SELECT if `has_role_on_account`; INSERT/UPDATE/DELETE only **owner/admin** (`20260329160000`).
- **Super-admin / MFA:** Additional policies in `20250302043537_mfa-rls-super-admin.sql`.

### 1.4 `feedflow` schema

**Foundation (`20260430165500` + expand `20260430210000`):**

| Table | Columns / notes |
|-------|------------------|
| **`social_accounts`** | `account_id`, optional `client_id`, `provider`, `external_account_id`, tokens, **`unique (account_id, provider, external_account_id)`**; expanded: `platform`, `platform_user_id`, `last_refreshed_at`, `token_status`, `connected_at` |
| **`widgets`** | `embed_key` unique, `social_account_id`, `name`, `settings` jsonb; expanded: layout, columns, `post_count`, captions/likes, slider, `accent_colour`, `custom_css`, etc. |
| **`feed_cache`** | Cached payload per account/social account; expanded: `raw_json`, `expires_at`, `cached_at` |
| **`videos`** | Bunny-oriented video rows |
| **`token_refresh_log`** | OAuth refresh attempts (`20260430210000`) |
| **`google_accounts`**, **`google_reviews_cache`** | Google Business / reviews |
| **`webflow_connections`**, **`webflow_sync_log`** | Webflow CMS sync |
| **`bunny_libraries`** | Bunny Stream library references |

**RLS:** Predominantly **`public.is_account_member(account_id)`** for account-scoped rows; **`feedflow_token_refresh_log_rw`**, **`feedflow_google_*`**, **`feedflow_webflow_*`**, **`feedflow_bunny_libraries_rw`** mirror that pattern. Grants: `20260430210000` grants usage on schema `feedflow` to `authenticated`, `service_role`.

### 1.5 `rankly` schema

**Foundation (`20260430165500`):**

| Table | Notes |
|-------|--------|
| **`projects`** | `account_id`, `name`, `domain`, `locale`; expanded: `colour`, `notes`, `target_country`, `target_language`, `track_desktop`, `track_mobile` |
| **`keywords`** | `project_id`, `keyword`, `search_engine`, `device`; expanded metrics columns |
| **`keyword_rankings`** | Ranking history; expanded: `device`, `serp_features`, `ai_overview_present`; date column renamed to **`date`**; unique `(keyword_id, date, device)` |
| **`backlinks`** | Per project; expanded crawl/status fields + FK to **`backlink_crawls`** |
| **`alerts`** | `keyword_id`, `user_id` → auth user; expanded `threshold_position`, `last_triggered_at` |

**Expand-only tables (`20260430211000`):**  
`project_competitors`, `tags`, `keyword_tag_assignments`, `domain_metrics`, `backlink_crawls`, `competitor_keywords`, `keyword_research_cache`, `alert_history`, `dataforseo_api_log`, `project_cron_state`.

**RLS:** Account membership via **`rankly.projects`** join for project-scoped data; **`rankly.alerts`** / alert-related rows tied to **`auth.uid()`** where applicable; **`keyword_research_cache`** has broad SELECT for authenticated (research cache); **`dataforseo_api_log`** deny SELECT for normal users. Policies are (re)declared in the expand migration for rankings/alerts.

### 1.6 `platform_merge` schema (`20260430170500`)

| Table | Purpose |
|-------|---------|
| **`id_mappings`** | Legacy id → UUID mapping (`source_app`, `entity_type`, `source_id`, `target_id`) |
| **`sync_runs`**, **`drift_checks`** | Operational sync/drift metadata |

**RLS:** All rows restricted to **`public.is_super_admin()`** for `authenticated`.

### 1.7 Storage policies (summary)

- **`account_image`** (and variants) on **`storage.objects`** for account avatars (`20221215192558_schema.sql`, `20260224120000_storage_account_image_clients.sql`).

---

## 2. Web app directory structure (`apps/web`)

There is **`no `apps/web/src`** folder. The canonical layout:

```
apps/web/
├── app/                    # Next.js App Router (routes, layouts, route handlers)
│   ├── api/                # Route handlers (REST, webhooks)
│   ├── auth/               # Callbacks, confirm, etc.
│   ├── admin/              # Admin UI (if enabled)
│   ├── home/
│   │   ├── (user)/         # Personal / user-scoped home routes
│   │   └── [account]/      # Team account workspace (slug param)
│   │       ├── _components/
│   │       ├── _lib/       # Shared server helpers, paths, loaders
│   │       ├── (feedflow)/ # Feedflow module routes (route group)
│   │       ├── (rankly)/   # Rankly module routes
│   │       ├── jobs/, clients/, invoices/, billing/, …
│   │       └── …
│   ├── join/, identifiable paths per product
│   ├── layout.tsx, error.tsx, global styling hooks
│   └── …
├── components/             # App-level providers, shell components
├── config/                 # paths.config, feature flags, navigation
├── lib/                    # App-specific libs (DB helpers, modules, validations)
├── public/                 # Static assets, locales
├── styles/                 # Global CSS, Tailwind/shadcn theme tokens
├── supabase/               # migrations, config, tests
├── proxy.ts                # Next.js proxy (auth/session edge behaviour)
└── package.json
```

Approximate scale: **~280+** `*.ts` / `*.tsx` files under `app/` (excluding `.next`).

**Monorepo packages consumed by `web`** (from `apps/web/package.json`): `@kit/ui`, `@kit/supabase`, `@kit/auth`, `@kit/team-accounts`, `@kit/next`, `@kit/billing`, `@kit/monitoring`, `@kit/i18n`, `@kit/accounts`, `@kit/admin`, and others — see section 3.

---

## 3. Package manifests

### 3.1 Root `package.json` (`keel/package.json`)

- **Name:** `keel`, **private** monorepo.
- **Package manager:** `pnpm@10.19.0`.
- **Node:** `>=20.10.0 <22`.
- **Scripts:** `dev`, `build`, `lint`, `typecheck`, `test`, `format`, Turbo tasks; **`supabase:web:*`** wrappers targeting the `web` workspace.
- **Overrides:** `@supabase/ssr`, `@supabase/supabase-js`, `zod` pinned for consistency.

### 3.2 `apps/web/package.json`

- **Name:** `web` — Next.js app (`next build` / `next dev --webpack`).
- **Key dependencies:** `next`, `react`, `@supabase/supabase-js`, `@tanstack/react-query`, `@tanstack/react-table`, `zod`, `react-hook-form`, `@hookform/resolvers`, `lucide-react`, `tailwindcss`, FullCalendar packages, `@dnd-kit/*`, `recharts`, `stripe`, PDF libs, workspace `@kit/*` packages.
- **Dev:** ESLint/Prettier/tsconfig workspaces, `supabase` CLI, Tailwind v4 postcss stack.
- **Supabase typegen:** Writes `packages/supabase/src/database.types.ts` and `apps/web/lib/database.types.ts`.

---

## 4. Auth, accounts, and tenancy

### 4.1 Identity

- **Supabase Auth** — users in **`auth.users`**.
- **Session:** Server/client via **`@kit/supabase`** (`getSupabaseServerClient`, browser client, middleware client).
- **Callbacks:** `apps/web/app/auth/callback/route.ts` uses **`createAuthCallbackService`** — supports `token_hash` + `type` (email/magic) and OAuth **`code`** exchange.
- **Middleware / proxy:** `apps/web/proxy.ts` uses **`createMiddlewareClient`** and **`getClaims()`** for route protection; failures log and behave as no session when Supabase is unreachable.

### 4.2 Tenancy model

- **`public.accounts`:** Every user has a **personal** account (`is_personal_account`, slug rules). **Team** accounts have a unique **`slug`** used in URLs (e.g. `/app/[account]` for workspaces, `/app` for personal).
- **`public.accounts_memberships`:** Links **`auth.users`** to **`accounts`** with **`account_role`** (references **`roles`**).
- **Primary owner:** `accounts.primary_owner_user_id`; transfer and membership protections implemented in SQL triggers/functions (`kit.*`, `public.transfer_team_account_ownership`, etc.).
- **Workspace context:** Loaded via **`createTeamAccountsApi`** RPC **`team_account_workspace`** and loaders such as **`loadTeamWorkspace`** — exposes account row, membership list, and is cached per request.

### 4.3 Space types and modules

- **`accounts.space_type`:** `work` | `family` | `community` (non-personal); enforced by CHECK (`20260329160000`).
- **`account_module_settings`:** Rows keyed by **`module_key`** + **`enabled`**. Application keys include **`jobs`**, **`schedule`**, **`clients`**, **`invoices`**, **`team`**, **`pipeline`**, **`feedflow`**, **`rankly`** (`apps/web/app/home/[account]/_lib/server/account-modules.ts`). Nav and route guards use **`isWorkModuleEnabled`**, **`isAccountModuleEnabled`**, **`getSpaceTypeFromAccount`**.

### 4.4 Row-level security patterns for new features

- Prefer **`public.is_account_member(account_id)`** or joins through **`accounts_memberships`** for team-scoped data.
- Admin-only toggles: **`has_role_on_account`** + role **`owner`/`admin`** pattern from **`account_module_settings`**.
- Service role: server-only routes (webhooks, cron, widget embeds) may use **`getSupabaseServerAdminClient`** — never expose to browsers.

---

## 5. UI component library and design system

### 5.1 `@kit/ui` (internal package)

- Located under **`packages/ui`**, consumed as **`@kit/ui`**.
- Built on **Radix UI** primitives (`radix-ui`, `@radix-ui/react-icons`), **class-variance-authority**, **tailwind-merge**, **lucide-react**, **cmdk**, **input-otp**, **react-day-picker**, **recharts**, etc.
- Provides buttons, inputs, dialogs, dropdowns, tables, forms, cards, sonner toasts, and layout primitives aligned with Makerkit patterns.

### 5.2 Styling

- **Tailwind CSS** with **shadcn-style** CSS variables and tokens (see **`apps/web/styles/`**, e.g. **`shadcn-ui.css`**).
- **Workspace shell:** Dashboard uses semantic tokens such as `--workspace-shell-header`, `--workspace-shell-canvas`, `--workspace-shell-text` (referenced throughout account layouts).

### 5.3 Brand / design reference

- **`DESIGN_SYSTEM.md`** (repo root): authoritative **Keel** typography (**Poppins** primary UI, **Roboto Slab** reserved), colour palette (steel, green, teal, purple, orange, navy shell), dashboard gradients, card/sidebar rules, status colours.
- **Rule of thumb for new UI:** Match existing **`@kit/ui`** components and **`DESIGN_SYSTEM.md`** tokens; avoid one-off colours outside the documented palette.

### 5.4 Other UI-related dependencies in `web`

- **Icons:** `lucide-react`, `@radix-ui/react-icons`.
- **Charts:** `recharts`.
- **Tables:** `@tanstack/react-table`.
- **Calendar:** `@fullcalendar/*`.
- **DnD:** `@dnd-kit/*`.
- **Theming:** `next-themes`.
- **i18n:** `@kit/i18n`, `react-i18next`, locale files under **`apps/web/public/locales`**.

---

## 6. Checklist before adding a new module

1. **Schema:** Choose **`public`** vs dedicated schema; if new schema, add to migrations **and** Supabase API config; add RLS and grants; run **`supabase gen types`**.
2. **Tenancy:** Every tenant row should reference **`account_id`** (or join path to **`accounts`**); use **`is_account_member`** or existing helpers in policies.
3. **Feature flags:** Add **`module_key`** usage in **`account_module_settings`** and wire **`account-modules.ts`** + nav config.
4. **App routes:** Place under **`app/home/[account]/`** with a route group if large; mirror **`_lib/server`**, **`_components`**, **`server-actions`** patterns used by **jobs** / **clients**.
5. **UI:** Use **`@kit/ui`** + **`DESIGN_SYSTEM.md`**.
6. **Auth:** Use **`getSupabaseServerClient`** + membership checks; prefer **server actions** with **`enhanceAction`** (`@kit/next`) where the repo already does.

---

## 7. Migration file index (chronological)

| Migration prefix | Topic |
|------------------|--------|
| `20220101000000` | API schemas: `feedflow`, `rankly`, `platform_merge` |
| `20221215192558` | Makerkit core: accounts, memberships, billing, notifications, storage policies, enums |
| `20240319163440` … `20260108114816` | Roles seed, OTP, team delete/create, invitations |
| `20260212*` | Onboarding, memberships, user_settings, permissions |
| `20260216*` | Clients, projects, jobs tables + RLS |
| `20260223*` | Job events |
| `20260224*` | Client profile fields, invitations |
| `20260228*` | Invoices v1 |
| `20260311*` … `20260314*` | Contractor RLS, clients |
| `20260327*` | User settings Keel contexts |
| `20260329*` | Jobs/invoices repair, space_type, module settings, team_account_workspace, slug RPC |
| `20260430*` | Profiles, feedflow/rankly foundation, platform_merge, expand schemas |

For column-level detail not inlined here, open the corresponding **`*.sql`** file.

---

*End of CODEBASE_SUMMARY.md*
