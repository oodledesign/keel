# Unified Platform Baseline

This file locks the baseline for the `keel` + `feedflow` + `rankly` merge.

## Base runtime

- Node: `>=20.10.0 <22` (workspace root)
- Next.js: `16.1.6` (catalog baseline in keel)
- React: `19.2.4` and `react-dom` `19.2.4`
- TypeScript: `^5.9.3`

## Shared dependency lock

- `@supabase/supabase-js`: `2.103.0`
- `@supabase/ssr`: `0.10.2`
- `@tanstack/react-query`: `5.90.21`
- `tailwindcss`: `4.1.18`

## Transitional constraints

- `zod` remains pinned at `3.25.76` for workspace compatibility.
- `rankly` code imported into this workspace must be upgraded from React 18/Next 14 conventions before direct adoption.

## Feedflow embed / token crypto

- Set `TOKEN_ENCRYPTION_KEY` (same rules as legacy Feedflow: hex, base64 32 bytes, or passphrase for scrypt) when using Instagram/TikTok feed ingestion and encrypted tokens.
- Public embed endpoint: `GET /api/feedflow/feed?widget=<embed_key>` (uses service role server-side only; no anon DB reads).

## Merge rule

Any new package added for feedflow/rankly migration should use catalog or workspace versions from this baseline unless explicitly approved in migration notes.
