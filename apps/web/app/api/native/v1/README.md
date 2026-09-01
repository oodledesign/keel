# Native iPhone API (`/api/native/v1`)

Cookie-free JSON API for the Ozer iPhone client. Authenticate with a **Supabase Auth access token** (JWT). Do not send Makerkit cookies. Do not use `keel_` recorder device tokens here — those stay Mac Assistant-only.

## Auth

```http
Authorization: Bearer <supabase access token>
```

Missing or invalid tokens return `401` with `{ "error": string }`. Workspace the user is not in returns `403`.

Get a user JWT from Supabase Auth (email/password, Google, or Apple when enabled), then call the API:

```bash
# Replace with your app origin and a real access_token from Supabase Auth.
export TOKEN='eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...'
export ORIGIN='http://localhost:3000'

curl -sS "$ORIGIN/api/native/v1/me" \
  -H "Authorization: Bearer $TOKEN"

curl -sS "$ORIGIN/api/native/v1/workspaces" \
  -H "Authorization: Bearer $TOKEN"

curl -sS "$ORIGIN/api/native/v1/today?workspace=YOUR_SLUG" \
  -H "Authorization: Bearer $TOKEN"

curl -sS "$ORIGIN/api/native/v1/tasks?workspace=YOUR_SLUG&day=2026-08-31" \
  -H "Authorization: Bearer $TOKEN"

curl -sS "$ORIGIN/api/native/v1/tasks?workspace=YOUR_SLUG&status=done&client=CLIENT_UUID&q=invoice" \
  -H "Authorization: Bearer $TOKEN"

curl -sS -X POST "$ORIGIN/api/native/v1/tasks" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title":"Call Dan","due":"2026-09-01","workspace":"YOUR_SLUG"}'

curl -sS "$ORIGIN/api/native/v1/notes?workspace=YOUR_SLUG" \
  -H "Authorization: Bearer $TOKEN"

curl -sS "$ORIGIN/api/native/v1/clients?workspace=YOUR_SLUG" \
  -H "Authorization: Bearer $TOKEN"

curl -sS "$ORIGIN/api/native/v1/clients/CLIENT_ID?workspace=YOUR_SLUG" \
  -H "Authorization: Bearer $TOKEN"

curl -sS "$ORIGIN/api/native/v1/invoices?workspace=YOUR_SLUG&status=open" \
  -H "Authorization: Bearer $TOKEN"

curl -sS "$ORIGIN/api/native/v1/invoices/INVOICE_ID?workspace=YOUR_SLUG" \
  -H "Authorization: Bearer $TOKEN"

curl -sS "$ORIGIN/api/native/v1/finances?workspace=YOUR_SLUG" \
  -H "Authorization: Bearer $TOKEN"

curl -sS -X POST "$ORIGIN/api/native/v1/devices" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"token":"DEVICE_TOKEN_HEX","platform":"ios","workspace":"YOUR_SLUG"}'
```

`workspace` accepts an account slug, UUID, or the chip aliases `personal`, `family`, and `business` (`business` maps to the first `work_design` workspace). Exact slug or UUID wins when they collide with an alias. Personal is always included in `/workspaces` (empty slug falls back to the account id). `/clients` includes `image` / `logo` HTTPS URLs; `GET /clients/:id` adds `contacts`.

`GET /tasks` query flags: `status=open|done|all` (default `open`; portal assignee rows stay out), optional `client=<uuid>`, optional `q` (case-insensitive title match). Personal still hides other people’s life tasks.

## Today

`GET /today` is a pocket dashboard, not the Mac Assistant recorder dump. It returns:

- `greeting`, `date`, `date_label`, optional `message`
- `tasks_due_today` / `overdue_tasks` (same task objects as `/tasks`)
- `recent_notes` (same note objects as `/notes`)
- `meetings_today` (`id`, `title`, `created_at`) on workspaces that record meetings
- `finances` on studio / surveyor / commercial workspaces (or `null`)
- `items` — flat due-today then overdue, for older clients that still read a list

## Invoices / finances

Shown on `work_design`, `commercial_property`, and `building_surveyor` only. Personal / family / community get an empty list / zeroed pocket (not 403). Archived invoices are excluded. Money is formatted with `formatWorkspaceMoney` (totals in pence).

`GET /invoices` query flags: `status=open|paid|overdue|all` (default `open`). `open` is issued unpaid (`sent`, `read`, `overdue`). Newest `created_at` first.

List fields: `id`, `number`, `client_name`, `status`, `due`, `total`, `total_pence`, `balance`, `balance_pence`, `currency`.

`GET /invoices/:id` adds `issued`, `paid`, `lines` (`description` + `amount`), `url` (hosted portal when `public_token` exists), and `web_path` (`/home/{slug}/invoices/{id}`).

`GET /finances` is the pocket overview: outstanding balance, overdue count + amount, paid this month when any paid invoices fall in the current UTC month, and the 5 most recent invoices.

There is no create / edit / PDF / Stripe checkout on this API.

## APNs (iPhone push)

Separate from browser VAPID (`/api/push`). The iPhone POSTs its device token after sign-in:

```
POST /api/native/v1/devices
{ "token": "<64-char hex>", "platform": "ios", "workspace": "<optional slug>" }
```

Rows live in `native_device_tokens` (RLS: a user can upsert their own tokens). The server sends an APNs alert when it already creates an in-app invoice notification (paid, overdue, viewed). Failures are logged and never break email or in-app. Deep link: `so.ozer.app://invoice/{id}` plus `invoice_id` in the payload.

Env (do **not** commit a `.p8`):

| Variable                                          | Notes                                                  |
| ------------------------------------------------- | ------------------------------------------------------ |
| `APNS_KEY_ID`                                     | Key ID from Apple Developer                            |
| `APNS_TEAM_ID`                                    | Defaults to `463T9J3286`                               |
| `APNS_P8`                                         | Contents of the AuthKey `.p8` (use `\\n` for newlines) |
| `APNS_P8_PATH`                                    | Absolute path to the `.p8` if you prefer a file        |
| `APNS_BUNDLE_ID`                                  | Defaults to `so.ozer.app`                              |
| `APNS_PRODUCTION` / `APNS_ENVIRONMENT=production` | Use `api.push.apple.com`; otherwise sandbox            |

If the key is missing, the server logs and skips send.

## Apple Sign In (optional)

Web OAuth shows Apple only when `NEXT_PUBLIC_AUTH_APPLE=true`. Configure the Apple **Services ID** in the Supabase Auth Apple provider (dashboard). Use `NEXT_PUBLIC_APPLE_SERVICE_ID` as the public Services ID if the native app needs it — do not put the Apple secret in this repo. Google OAuth is unchanged.
