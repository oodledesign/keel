# Feedflow — Instagram Login setup

Feedflow uses **Instagram Login** (Business Login for Instagram). It does **not** use Facebook Login or a Facebook Page.

Instagram **Auto-Reply** is a different product. Keep its `META_INSTAGRAM_*` / `META_REDIRECT_URI` values unchanged.

## Environment variables

Set these on the Ozer web app (Vercel / `.env.local`):

```bash
FEEDFLOW_INSTAGRAM_APP_ID=                  # Instagram App ID (not Facebook App ID)
FEEDFLOW_INSTAGRAM_APP_SECRET=              # Instagram App Secret
FEEDFLOW_INSTAGRAM_REDIRECT_URI=https://app.ozer.so/api/feedflow/auth/instagram/callback
TOKEN_ENCRYPTION_KEY=                       # existing AES-256-GCM key (32+ bytes)
CRON_SECRET=                                # existing Vercel cron bearer secret
```

**Callback URL (exact):**

```text
https://<your-host>/api/feedflow/auth/instagram/callback
```

If `FEEDFLOW_INSTAGRAM_REDIRECT_URI` is omitted, Feedflow derives
`{NEXT_PUBLIC_SITE_URL}/api/feedflow/auth/instagram/callback`.

### Fallback (legacy names only)

If a `FEEDFLOW_INSTAGRAM_*` value is absent, Feedflow may fall back to:

- `INSTAGRAM_APP_ID`
- `INSTAGRAM_APP_SECRET`
- `INSTAGRAM_REDIRECT_URI`

It **never** reads Auto-Reply’s `META_INSTAGRAM_APP_ID`, `META_INSTAGRAM_APP_SECRET`, or `META_REDIRECT_URI`.

Prefer the `FEEDFLOW_*` names so Auto-Reply and Feedflow can use different Meta apps or redirect URIs.

## Meta dashboard steps

1. Open [Meta for Developers](https://developers.facebook.com/) and create or select a **Business** type app.
2. Add the **Instagram** product.
3. In **Instagram → API setup → Business login settings**, copy the **Instagram App ID** and **Instagram App Secret**.
   - Do **not** use **App settings → Basic** (that Facebook App ID is the wrong ID for Instagram Login).
4. Add the Feedflow redirect URI above to **Valid OAuth Redirect URIs**.
5. Request only **`instagram_business_basic`** (read profile + media). Do not add comments, messages, or publish for this slice.
6. **App Review** is required before accounts outside the tester list can connect. Add Dan’s Instagram Business/Creator account as a tester while the app is in Development.
7. The connected Instagram account must be a **Business** or **Creator** account. No Facebook Page is required.

## Token refresh

Long-lived Instagram user tokens last about 60 days. Vercel cron
`/api/cron/feedflow-token-refresh` (daily 02:30 UTC) refreshes them around day 50 via
`graph.instagram.com/refresh_access_token`. Attempts are written to `feedflow.token_refresh_log`.

Media is ingested on connect and by `/api/cron/feedflow-media-ingest` (hourly). Public embeds
read persisted posts only — they do not call Graph on each pageview.

## Grant Feedflow for testing

Feedflow stays **Coming soon** (`addon_feedflow` in `IN_DEVELOPMENT_WORKSPACE_ADDON_KEYS`).
A super-admin grant on the workspace unlocks Social accounts / Widgets for Dan. Workspace
types that host Apps: **work** and **commercial-property**.
