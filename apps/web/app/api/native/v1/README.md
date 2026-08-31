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

curl -sS -X POST "$ORIGIN/api/native/v1/tasks" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title":"Call Dan","due":"2026-09-01","workspace":"YOUR_SLUG"}'

curl -sS "$ORIGIN/api/native/v1/notes?workspace=YOUR_SLUG" \
  -H "Authorization: Bearer $TOKEN"
```

`workspace` accepts an account slug or UUID. Personal is always included in `/workspaces`.

## Apple Sign In (optional)

Web OAuth shows Apple only when `NEXT_PUBLIC_AUTH_APPLE=true`. Configure the Apple **Services ID** in the Supabase Auth Apple provider (dashboard). Use `NEXT_PUBLIC_APPLE_SERVICE_ID` as the public Services ID if the native app needs it — do not put the Apple secret in this repo. Google OAuth is unchanged.
