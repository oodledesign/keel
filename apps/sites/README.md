# Ozer Sites (`apps/sites`)

Public renderer for **Publish to Ozer Sites** (Prompts F1 / F2).

## Why a separate app

- Host-based multi-tenant middleware (`*.sites.ozer.so` + custom domains) without the SaaS shell / CSRF / MFA weight of `apps/web`.
- Independent Vercel project and cache policy for public HTML.
- Shares `@kit/site-blocks-core` + the **same** Supabase project as Site Studio (`igewpbdkvvhclfprteca` / local) — tables `site_sites`, `site_pages`, `site_domains`.

## Vercel

Project: **`ozer-sites`** (team `oodle-designs-projects`), Git root `apps/sites`, same `oodledesign/keel` repo as `ozer`.

Env (already set on the project for production / preview / development):

- `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY` (server-only — published pages only; `SUPABASE_SECRET_KEY` also accepted)
- `NEXT_PUBLIC_OZER_SITES_ROOT_DOMAIN=sites.ozer.so`

Domains (manual in Vercel + DNS):

- Attach `sites.ozer.so` and wildcard `*.sites.ozer.so`.
- Custom domains: add `site_domains` rows; after DNS verification set `verified_at`.

## Local

```bash
pnpm --filter sites dev
# http://localhost:3011 with Host header or /tenant/{host}/{slug}
```

## Data / RLS

Workspace members manage rows via RLS in `apps/web`. This app **never** uses anon key for page HTML — only service role after hostname resolution.
