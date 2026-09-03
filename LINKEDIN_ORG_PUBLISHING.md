# LinkedIn company-page publishing (commercial disposals)

Ozer can post a disposal to a workspace **LinkedIn organization (company) page** from the listing **Publishing** tab. Posts are never sent automatically when a listing is published — only **Post now** or **Schedule**.

This is separate from LinkedIn **contact import** (`apps/web/lib/integrations/linkedin/`).

## LinkedIn developer verification

Connect will not work for customer workspaces in production until LinkedIn approves the **Community Management API** product on the Ozer developer app.

1. Open [LinkedIn Developers](https://www.linkedin.com/developers/apps) and select the Ozer app.
2. Add / request the **Community Management** product (Posts API, Images API, MultiImage).
3. Request the organization scopes below. An org **page admin** must complete OAuth.
4. Add the exact redirect URI to **Authorized redirect URLs**.
5. Until the product is approved, only LinkedIn app testers / developer-role users can connect.

Organic scheduling is **not** a LinkedIn API feature. Ozer stores `scheduled_at` and publishes from a cron worker.

## Environment variables

Set these on the Ozer web app (Vercel / `.env`):

```bash
LINKEDIN_CLIENT_ID=
LINKEDIN_CLIENT_SECRET=
LINKEDIN_REDIRECT_URI=https://app.ozer.so/api/linkedin-org/auth/callback
TOKEN_ENCRYPTION_KEY=                       # existing AES-256-GCM key (32+ bytes)
CRON_SECRET=                                # existing Vercel cron bearer secret
OAUTH_STATE_SECRET=                         # optional; falls back to TOKEN_ENCRYPTION_KEY
```

If `LINKEDIN_REDIRECT_URI` is omitted, Ozer derives
`{NEXT_PUBLIC_APP_SITE_URL or NEXT_PUBLIC_SITE_URL}/api/linkedin-org/auth/callback`.

If `LINKEDIN_CLIENT_ID` is missing, Website & portals shows **LinkedIn app not configured** instead of crashing.

### Callback URL (exact)

```text
https://<your-host>/api/linkedin-org/auth/callback
```

## OAuth scopes

- `w_organization_social` — post as the organization (never as the member’s personal profile)
- `r_organization_social` — list / read org pages the member administers
- `openid` `profile` `email` — current LinkedIn Sign In with LinkedIn (OIDC)

Author URN is always `urn:li:organization:{id}`.

## API version

Requests use Community Management **Posts API** (not the deprecated UGC shares API):

- Base: `https://api.linkedin.com/rest`
- Headers: `Linkedin-Version: 202608`, `X-Restli-Protocol-Version: 2.0.0`
- Images: `POST /rest/images?action=initializeUpload` then PUT binary (`owner` = organization URN)
- 1 image → Posts API `content.media`; 2–20 images → MultiImage API

## Cron

Registered in `apps/web/vercel.json`:

| Path | Schedule | Purpose |
|------|----------|---------|
| `/api/cron/linkedin-org-publish` | every 5 minutes | Publish due `listing_linkedin_posts` (`status=scheduled`) |
| `/api/cron/linkedin-token-refresh` | daily 02:00 UTC | Refresh org tokens expiring within 7 days |

Both require `Authorization: Bearer $CRON_SECRET`.

If LinkedIn does not issue a refresh token, a 401 marks the connection `needs_reconnect` and the workspace is asked to Connect again.

## Workspace UX

- **Website & portals** (`/home/[account]/commercial-publishing`): Connect / pick page / Disconnect
- **Disposal → Publishing**: LinkedIn card (copy, photos, overlay, draft / post / schedule)

Public listing URL resolution (never invents a domain):

1. Listing website URL
2. Live portal publication URL (Property Hive, EACH, Rightmove)
3. Ozer brochure share (`/share/brochure/:token`) when enabled
4. Otherwise: allow a draft and say there is no public URL yet

AI copy spends the existing workspace **AI credit pool** (`commercial_listing_linkedin_post`, same 3-credit Haiku metering as listing marketing copy). It is not a new Stripe / credit product.
