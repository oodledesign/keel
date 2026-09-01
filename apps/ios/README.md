# Ozer iPhone app

Native SwiftUI shell for Ozer. This is a real Xcode project — not Next.js, not Capacitor, and not part of the pnpm/turbo workspace.

- **App name:** Ozer
- **Bundle ID:** `so.ozer.app`
- **Platform:** iOS 17+, iPhone first
- **Project:** `apps/ios/Ozer.xcodeproj`

`pnpm`, Turbo, and Vercel ignore this folder. Do not add a `package.json` here.

## Open in Xcode

1. On a Mac, open `apps/ios/Ozer.xcodeproj`.
2. Signing & Capabilities → Team: pick **463T9J3286** or **842M7N9D4D**. `DEVELOPMENT_TEAM` is empty in git (Automatic signing).
3. Copy config and add the public anon key locally:

```bash
cp apps/ios/Config/Local.xcconfig.example apps/ios/Config/Local.xcconfig
```

4. Run on an iPhone or simulator.

`Local.xcconfig` is gitignored. Never commit a real Supabase anon key.

## Config keys

Set in `Config/Shared.xcconfig` (defaults) and optional `Config/Local.xcconfig` (overrides). Values are copied into `Info.plist` at build time.

| Key | Default | Notes |
|-----|---------|--------|
| `OZER_API_BASE` | `https://app.ozer.so` | Native API host |
| `OZER_SUPABASE_URL` | `https://igewpbdkvvhclfprteca.supabase.co` | Auth host |
| `OZER_SUPABASE_ANON_KEY` | _(empty)_ | **Local only.** Placeholder in git. |

`//` starts a comment in xcconfig, so URLs are written as `https:/$()/app.ozer.so`.

## Auth

Sign in with **Apple**, **Google**, or a **magic-link email**. Access and refresh tokens are stored in the Keychain (`so.ozer.app`). Sign out deletes every Keychain item for that service.

- Apple: `AuthenticationServices` → GoTrue `grant_type=id_token`
- Google: ephemeral `ASWebAuthenticationSession` + PKCE (no cookies)
- Magic link (app): `POST /auth/v1/otp?redirect_to=https://app.ozer.so/auth/native`. Mail opens that HTTPS page, which hops to `so.ozer.app://auth-callback`. After “Email me a link”, the sign-in screen also accepts the 8-digit email code via `POST /auth/v1/verify`.
- Magic link (website): unchanged — Makerkit still uses `/auth/callback`. Do not point web `emailRedirectTo` at `/auth/native`.

Add these redirect URLs in **Supabase → Authentication → URL Configuration → Redirect URLs**:

```
so.ozer.app://auth-callback
https://app.ozer.so/auth/native
```

If the project uses wildcards, also add:

```
https://app.ozer.so/auth/native/**
```

Enable Apple and Google providers there as well. A 401 from the native API signs the user out.

**Magic Link email template:** the hosted template is not changed in this repo. In **Authentication → Email Templates → Magic Link**, include the OTP so the iPhone field can be filled (`{{ .Token }}` in the default GoTrue variables). Keep `{{ .ConfirmationURL }}` as the single link — one ConfirmationURL per email, chosen by where the OTP was requested.

## Workspaces

After sign-in the shell loads `{OZER_API_BASE}/api/native/v1/workspaces` — the same memberships as the web switcher (personal account plus every team). The chip title is the account **name** (Personal, Oodle, Bracketts). Profile is a subtitle only (Family, Surveyor, Commercial property, Studio).

Selection is a real `{ id, slug }` row, stored in UserDefaults. Today and Tasks send that slug (or id). If the saved row is gone (membership revoked), the shell falls back to personal, then the first remaining space. An empty list is a calm retry — not fake Personal / Family / Business chips.

## Today API

```
GET {OZER_API_BASE}/api/native/v1/today?workspace=<slug-or-uuid>
Authorization: Bearer <access_token>
Accept: application/json
```

The server still accepts the legacy aliases `personal`, `family`, and `business`. The iPhone client sends a real slug or UUID. Home decodes `tasks_due_today` then `overdue_tasks` (title + subtitle). A 403 is shown as an error, not an empty day.

No cookies. A 404 is shown as a calm empty state. Reloads when the selected workspace **id** changes, and when the membership list first arrives.

## Tasks API

The Tasks tab uses the same workspace slug or UUID as Today:

```
GET {OZER_API_BASE}/api/native/v1/tasks?workspace=<slug-or-uuid>
Authorization: Bearer <access_token>
Accept: application/json
```

The list is `{ "items": [{ "id", "title", "status", "due", "client_id", "client_name" }] }` — open tasks for the workspace (due today, overdue, later). Business lists include workspace tasks even when `user_id` is null. Title plus due and client name. Empty only when `items` is empty. A 403 is an error, not an empty list.

```
POST {OZER_API_BASE}/api/native/v1/tasks
{ "title", "due?", "client_id?", "workspace" }

PATCH {OZER_API_BASE}/api/native/v1/tasks/{id}
{ "title?", "due?", "client_id?", "status?" }
```

`status` of `completed` or `done` marks the task done. `client_id` must belong to the workspace; `null` clears it. Optional `?client=<uuid>` filters the list. The iPhone list can add, edit, attach a client, and tick complete.

## Notes API

Same workspace query and error mapping as Tasks (401 / 403 / 404):

```
GET {OZER_API_BASE}/api/native/v1/notes?workspace=<slug-or-uuid>
Authorization: Bearer <access_token>
Accept: application/json
```

The list is `{ "items": [{ "id", "title", "body", "workspace", "created_at", "updated_at" }] }`. Row title falls back to the first body line, then “Untitled”. Subtitle is a truncated body or a relative date. Tap opens a read-only title + body screen. No create or edit on the phone yet.

## People API

```
GET {OZER_API_BASE}/api/native/v1/people?workspace=<slug-or-uuid>
Authorization: Bearer <access_token>
Accept: application/json
```

The list is `{ "items": [{ "id", "full_name", "nickname", "relationship_label", "email", "phone", "avatar_url", … }] }`. The server filters `person.account_id === workspace.id`, so Personal usually has people and team workspaces may be empty. Row title is `full_name` (or nickname). Subtitle is relationship or email. A small `https` avatar is optional; initials show otherwise. Tap opens a read-only card from those list fields only (no extra GET).

## Clients API

Cookie-free Bearer JSON. Shown on studio / surveyor / commercial property workspaces (`work_design`, `commercial_property`, `building_surveyor`). Personal and family hide the menu link and receive an empty list (not 403).

```
GET {OZER_API_BASE}/api/native/v1/clients?workspace=<slug-or-uuid>
Authorization: Bearer <access_token>
Accept: application/json
```

The list is `{ "items": [{ "id", "name", "email", "company_name", "client_type" }] }`. `name` uses the same display rules as web (`display_name` or first + last). Tap a client for a read-only card and that client’s open tasks, plus add-task pre-filled with `client_id`.

## Menu

Workspace picker at the **top** (logo + name). Tap opens `WorkspaceSwitcherView` — memberships are not listed inline. Nav links under the picker follow the selected space: Home, Tasks, Notes always; People on personal / family; Clients on business profiles; Shopping stays a stub. Sign out and the email footer stay at the bottom. Switching workspace updates the links and leaves the menu open.

## Tab bar

Matches the web PWA: **Home | 3 pin slots | Menu**. Pins default to Tasks, Notes, People. Shopping is in the Menu and is still a navigation stub.

Out of scope: PowerSync, camera, Whisper, invoices, secrets, App Store submit, `WKWebView` of the web app.

## Monorepo

`apps/ios` is excluded from `pnpm-workspace.yaml`. `scripts/vercel-ignore.sh` skips **ozer** / **ozer-docs** / **ozer-sites** when the diff is only under `apps/ios/`.
