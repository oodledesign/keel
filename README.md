# Makerkit - Supabase SaaS Starter Kit - Turbo Edition

This is a Starter Kit for building SaaS applications using Supabase, Next.js, and Tailwind CSS.

A demo version of this project can be found at [makerkit/next-supabase-saas-kit-turbo-demo](https://github.com/makerkit/next-supabase-saas-kit-turbo-demo). This version contains a tasks functionality that is not present in the original version, multiple languages, and other various modifications.

[Please follow the documentation to get started](https://makerkit.dev/docs/next-supabase-turbo/introduction).

**Please remember to update the repository daily**.

## Signatures module (Ozer)

Ozer includes a **Signatures** workspace module for Microsoft 365–connected email signatures (staff sync, HTML templates, push to Outlook).

- **Module flag**: `account_module_settings.module_key = 'signatures'` (enable per team account).
- **Required environment variables** (web app): `AZURE_CLIENT_ID`, `AZURE_CLIENT_SECRET`, `AZURE_REDIRECT_URI` (see [SIGNATURES_SETUP.md](./SIGNATURES_SETUP.md)).
- **Setup guide**: [SIGNATURES_SETUP.md](./SIGNATURES_SETUP.md) (Azure app registration, API permissions, consent, storage bucket overview).