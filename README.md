# Makerkit - Supabase SaaS Starter Kit - Turbo Edition

This is a Starter Kit for building SaaS applications using Supabase, Next.js, and Tailwind CSS.

A demo version of this project can be found at [makerkit/next-supabase-saas-kit-turbo-demo](https://github.com/makerkit/next-supabase-saas-kit-turbo-demo). This version contains a tasks functionality that is not present in the original version, multiple languages, and other various modifications.

[Please follow the documentation to get started](https://makerkit.dev/docs/next-supabase-turbo/introduction).

**Please remember to update the repository daily**.

## LinkedIn company-page publishing (commercial)

Commercial-property workspaces can post disposals to a LinkedIn **organization page** from Marketing / Management. Setup, Community Management API verification, env vars, and cron: [LINKEDIN_ORG_PUBLISHING.md](./LINKEDIN_ORG_PUBLISHING.md).

## Signatures module (Ozer)

Ozer includes a **Signatures** workspace module for Microsoft 365–connected email signatures (staff sync, HTML templates, push to Outlook).

- **Module flag**: `account_module_settings.module_key = 'signatures'` (enable per team account).
- **Required environment variables** (web app): `AZURE_CLIENT_ID`, `AZURE_CLIENT_SECRET`, `AZURE_REDIRECT_URI` (see [SIGNATURES_SETUP.md](./SIGNATURES_SETUP.md)).
- **Setup guide**: [SIGNATURES_SETUP.md](./SIGNATURES_SETUP.md) (Azure app registration, API permissions, consent, storage bucket overview).

## Dynamics 365 (Campaigns mailing list)

Ozer owns the marketing list. After a public mailing-list signup, Ozer upserts a **Dataverse Contact** (or Lead) with marketing-consent flags. Dynamics is not consent source of truth.

- **Workspace UI**: Settings → Integrations → Dynamics 365 (tenant ID, environment URL, app registration client ID + secret, field mapping, test connection).
- **Secrets**: AES-256-GCM via `TOKEN_ENCRYPTION_KEY` (same pattern as Bunny / Feedflow). Paste the Azure **client secret value** in settings — do not put it in env or git.
- **Setup + field map**: [apps/web/lib/dynamics/README.md](./apps/web/lib/dynamics/README.md).
- **Retry**: `GET /api/cron/dynamics-contact-sync` (Bearer `CRON_SECRET`). Public signup never fails if Dynamics is down.
- **CI**: mapper + Dataverse client tests use mocked `fetch`. Live Entra / Dataverse OAuth is not run in CI.

## Building-surveyor GOV.UK EPC

Energy Performance Certificates are a **platform** integration, not per-user registration. Server-only fetch on `survey_report` rows in `building-surveyor` workspaces. After address confirm, the hub prefills Energy (J) / About the property; surveyors can override auto-pulled fields.

- **Env name (exact):** `GOV_UK_EPC_API_BEARER_TOKEN`
- **New box processes:** already receive this env (Dan). Do not ask surveyors to paste a token.
- **Vercel Production:** Project Settings → Environment Variables on the `web` project. Add `GOV_UK_EPC_API_BEARER_TOKEN` as **Sensitive**, environment **Production**. Add Preview only if you want lookup on preview deploys. Redeploy after saving.
- **Turbo:** `globalEnv` allowlists `GOV_UK_EPC_API_BEARER_TOKEN` so the Next.js server runtime can read it. Do not prefix with `NEXT_PUBLIC_`.
- **CI:** fixture unit tests only. The live Energy Certificate Data API is not called in CI.