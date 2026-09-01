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
- Magic link (app): `POST /auth/v1/otp?redirect_to=https://app.ozer.so/auth/native`. Mail opens that HTTPS page, which hops to `so.ozer.app://auth-callback`. After “Email me a link”, the sign-in screen also accepts the 6-digit email code via `POST /auth/v1/verify`.
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

## Today API

After sign-in the shell loads `{OZER_API_BASE}/api/native/v1/workspaces` and maps the Personal / Family / Business chips to a real account (`isPersonal` or `profile=personal`, `family`, `work_design`). Today then sends that slug or UUID:

```
GET {OZER_API_BASE}/api/native/v1/today?workspace=<slug-or-uuid>
Authorization: Bearer <access_token>
Accept: application/json
```

The server also accepts the chip aliases `personal`, `family`, and `business` if the list has not loaded yet. Home decodes `tasks_due_today` then `overdue_tasks` (title + subtitle). A 403 is shown as an error, not an empty day.

No cookies. A 404 is shown as a calm empty state.

Workspace switcher is **Personal / Family / Business** only.

## Tab bar

Matches the web PWA: **Home | 3 pin slots | Menu**. Pins default to Tasks, Notes, People. Shopping is in the Menu. Those screens are navigation stubs.

Out of scope: PowerSync, camera, Whisper, invoices, secrets, App Store submit, `WKWebView` of the web app.

## Monorepo

`apps/ios` is excluded from `pnpm-workspace.yaml`. `scripts/vercel-ignore.sh` skips **ozer** / **ozer-docs** / **ozer-sites** when the diff is only under `apps/ios/`.
