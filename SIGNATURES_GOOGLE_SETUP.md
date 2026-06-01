# Signatures module — Google Workspace setup

Keel’s **Signatures** module can sync staff from Google Workspace and push HTML signatures to Gmail using **domain-wide delegation (DWD)** and a Google Cloud **service account**.

## Prerequisites

- Google Workspace (not personal Gmail)
- Workspace **Super Admin** access
- Hosted Supabase with the **`signatures`** schema exposed (see [SIGNATURES_SETUP.md](./SIGNATURES_SETUP.md))

## 1. Google Cloud project

1. Open [Google Cloud Console](https://console.cloud.google.com/) → create or select a project.
2. Enable APIs:
   - **Admin SDK API**
   - **Gmail API**

## 2. Service account

1. **IAM & Admin → Service accounts → Create service account** (e.g. `keel-signatures`).
2. Open the service account → **Advanced settings → Domain-wide Delegation** — note the numeric **Client ID**.
3. **Keys → Add key → JSON** — download the key (store securely; used server-side only).

## 3. Authorize in Google Admin

1. [admin.google.com](https://admin.google.com/) → **Security → Access and data control → API controls → Domain-wide delegation → Add new**.
2. **Client ID:** your service account Client ID.
3. **OAuth scopes** (comma-separated):

```text
https://www.googleapis.com/auth/admin.directory.user.readonly,https://www.googleapis.com/auth/gmail.settings.basic
```

4. **Authorize**

## 4. Environment variables (Keel web app)

Use **one** of these patterns in Vercel / `.env.local`:

```bash
# Option A — full JSON (recommended on Vercel)
GOOGLE_SERVICE_ACCOUNT_JSON={"type":"service_account","project_id":"...","private_key":"-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n","client_email":"keel-signatures@....iam.gserviceaccount.com",...}

# Option B — split fields
GOOGLE_SERVICE_ACCOUNT_EMAIL=keel-signatures@your-project.iam.gserviceaccount.com
GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```

Redeploy after adding env vars.

## 5. Connect in Keel

1. Open **Signatures → Settings**.
2. Under **Google Workspace connection**, enter:
   - **Primary domain** — e.g. `oodledesign.com`
   - **Delegated admin email** — a Super Admin on that domain, e.g. `you@oodledesign.com`
3. Click **Connect Google Workspace**.

Keel verifies Directory API access, saves the connection, then you can **Sync staff** and **Push All** from the dashboard.

## 6. Provider priority

If both Microsoft 365 and Google Workspace are connected, Keel uses **Google Workspace** for sync and push. Disconnect Google to use Microsoft only.

## 7. Gmail client notes

- Signatures apply to the user’s primary **send-as** address via Gmail settings API.
- Gmail may strip some CSS; test templates in Gmail web after push.
- Mobile Gmail can take time to reflect signature changes.

## 8. Apply database migration

Run from `apps/web`:

```bash
pnpm exec supabase db push
```

Requires migration `20260601120000_signatures_google_workspace.sql` (`google_connections` table + `staff.google_user_id`).
