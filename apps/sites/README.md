# Ozer Sites (`apps/sites`)

Public renderer for **Publish to Ozer Sites** (Prompts F1 / F2).

## Why a separate app

- Host-based multi-tenant middleware (`*.sites.ozer.so` + custom domains) without the SaaS shell / CSRF / MFA weight of `apps/web`.
- Independent Vercel project and cache policy for public HTML.
- Shares `@kit/site-blocks-core` + the **same** Supabase project as Site Studio (`igewpbdkvvhclfprteca` / local) — tables `site_sites`, `site_pages`, `site_domains`.

## Vercel

1. Create a Vercel project rooted at `apps/sites`.
2. Env:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY` (server-only — published pages only)
   - `NEXT_PUBLIC_OZER_SITES_ROOT_DOMAIN=sites.ozer.so`
3. Domains:
   - Attach `sites.ozer.so` and wildcard `*.sites.ozer.so` (or Vercel wildcard for the preview root).
   - Custom domains: add `site_domains` rows; after DNS verification set `verified_at`.

## Local

```bash
pnpm --filter sites dev
# http://localhost:3011 with Host header or /_sites/{host}/{slug}
```

## Data / RLS

Workspace members manage rows via RLS in `apps/web`. This app **never** uses anon key for page HTML — only service role after hostname resolution.
