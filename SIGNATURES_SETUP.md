# Signatures module — Microsoft Azure setup

This guide configures Microsoft Entra ID (Azure AD) for Ozer’s **Signatures** module: directory sync, profile photos, and mailbox signature updates via Microsoft Graph.

## Hosted Supabase (required)

Signatures data lives in the Postgres schema **`signatures`**. For **hosted** Supabase (not only local Docker), you must:

1. **Expose the schema to PostgREST** — Dashboard → **Project Settings** → **API** → **Exposed schemas** → add **`signatures`** (alongside `public`, etc.). Without this, the REST API returns **406** and the app reports **`Invalid schema: signatures`**.
2. **Apply migrations** that create `signatures` tables and RLS (same migrations as in `apps/web/supabase/migrations/`).

`supabase/config.toml` `[api] schemas` only affects the **local** stack; it does not change a remote project’s exposed schemas.

## 1. Create an app registration

1. Open [Azure Portal](https://portal.azure.com) → **Microsoft Entra ID** → **App registrations** → **New registration**.
2. **Name**: e.g. `Ozer Signatures`.
3. **Supported account types**: **Accounts in any organizational directory (Any Microsoft Entra ID tenant — Multitenant)** (recommended for connecting customer tenants).
4. **Redirect URI**: **Web** — `{APP_URL}/api/signatures/ms-callback`  
   Replace `{APP_URL}` with your deployed site origin (e.g. `https://app.example.com`). For local dev, use your local origin and register the same path.

## 2. API permissions (application permissions)

Add **Microsoft Graph** → **Application permissions** (not Delegated):

| Permission | Purpose |
|------------|---------|
| `MailboxSettings.ReadWrite` | Update mailbox / signature-related settings where supported by Graph |
| `User.Read.All` | List users for staff sync |
| `ProfilePhoto.Read.All` | Read profile photos for signature thumbnails |

Then **Grant admin consent** for your directory (and ensure tenant admins consent when connecting customer tenants, if required by your deployment model).

> **Note:** The OAuth “Connect Microsoft 365” flow uses delegated scopes with the same permission *names* for consent UX; Graph calls for sync and token refresh in Ozer use **client credentials** against the stored tenant ID and rely on these **application** permissions for directory-wide access.

## 3. Client secret

1. **Certificates & secrets** → **New client secret**.
2. Copy the **Value** immediately (it is shown once).

## 4. Environment variables (Ozer web app)

Set in your deployment environment (and `.env.local` for development):

```bash
AZURE_CLIENT_ID=<Application (client) ID from the app registration>
AZURE_CLIENT_SECRET=<Client secret value>
AZURE_REDIRECT_URI=https://<your-host>/api/signatures/ms-callback
```

Optional: if `AZURE_REDIRECT_URI` is omitted, Ozer may derive the callback URL from `NEXT_PUBLIC_SITE_URL`; registering the exact URI in Azure must still match what the app sends.

## 5. Enable the module per workspace

Signatures is gated by `public.account_module_settings`:

- **`module_key`**: `signatures`
- **`enabled`**: `true`

Owners/admins can manage module toggles from team account settings (see product UI). Until enabled, the Signatures area shows a **module not enabled** state with links to settings/billing.

## 6. Outlook desktop vs Outlook on the web

HTML signature behavior differs by client (Outlook desktop vs OWA). Microsoft Graph’s supported surface for **setting** the HTML signature varies by tenant and API version. Ozer may still **render** the correct HTML for preview and push attempts; confirm Graph capabilities for your tenant before relying on automatic deployment to all clients.

## 7. Storage

Staff photos are stored in the private Supabase Storage bucket **`signatures-photos`** (see migrations). Authenticated members can **read** objects whose path starts with an `account_id` they belong to; server-side sync/uploads use the service role.
