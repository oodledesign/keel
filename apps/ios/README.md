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

## Permissions

`Ozer/Info.plist` asks for the microphone and on-device speech recognition (Ozer-specific strings, not generic). `UIBackgroundModes` includes `audio` so a meeting can keep recording when the screen locks. No iCloud. Speech uses Apple’s Speech framework with `requiresOnDeviceRecognition` and locale `en-GB`.

The iOS Simulator must not run live on-device Speech, a mic tap that hops to the main actor, or the pyannote/WeSpeaker models — that pins the host CPU. Meetings on Simulator start a timer-only placeholder and show that live captions need a real iPhone. Dictation fails fast with the same message. Permission prompts time out instead of hanging after Allow.

Speaker models come from FluidInference’s CoreML conversion of pyannote (CC-BY-4.0) and WeSpeaker (Apache-2.0). Ozer downloads them at first meeting on a real iPhone.

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
- Magic link (app): `POST /auth/v1/otp?redirect_to=https://app.ozer.so/auth/native`. The email button uses `/auth/confirm?token_hash=…&callback=…`. For a native callback, confirm does **not** verify in the browser (that burned the token and opened the app empty). It hops to `/auth/native?token_hash=…`, then `so.ozer.app://auth-callback`, and the app POSTs `/auth/v1/verify`. After “Email me a link”, the sign-in screen still accepts the 8-digit email code.
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

After sign-in the shell loads `{OZER_API_BASE}/api/native/v1/workspaces` — the same memberships as the web switcher (personal account plus every team). Personal is always first and labeled **Personal** (the account name is the subtitle). Other chips use the account name (Oodle, Bracketts). Profile is a subtitle only (Family, Surveyor, Commercial property, Studio).

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

Optional query flags: `status=open|done|all` (default `open`), `client=<uuid>` for one client, `q` for a title `ilike`. Portal assignee rows stay off the list. Personal still hides other people’s life tasks.

The list is `{ "items": [{ "id", "title", "status", "due", "client_id", "client_name" }] }`. Default is open tasks for the workspace (due today, overdue, later). Business lists include workspace tasks even when `user_id` is null. Title plus due and client name. Empty only when `items` is empty. A 403 is an error, not an empty list.

The iPhone list searches the loaded rows (title and client name) as you type, and filters by due (All / Today / Overdue / Upcoming / No date) and status (Open / Done / All). Business workspaces add a client chip (all, no client, or one client from `/clients`). `?client=` is sent only for a specific client. Completing a task still works; Add stays in the toolbar. Filter state resets when the workspace changes.

```
POST {OZER_API_BASE}/api/native/v1/tasks
{ "title", "due?", "client_id?", "workspace" }

PATCH {OZER_API_BASE}/api/native/v1/tasks/{id}
{ "title?", "due?", "client_id?", "status?" }
```

`status` of `completed` or `done` marks the task done. `client_id` must belong to the workspace; `null` clears it. The iPhone list can add, edit, attach a client, and tick complete. The first ~20 open tasks for the selected workspace are cached on disk so a cold launch (including after an Xcode rebuild) still shows the last list immediately, then refreshes.

## Notes API

Same workspace query and error mapping as Tasks (401 / 403 / 404):

```
GET {OZER_API_BASE}/api/native/v1/notes?workspace=<slug-or-uuid>
Authorization: Bearer <access_token>
Accept: application/json
```

The list is `{ "items": [{ "id", "title", "body", "workspace", "category?", "tags?", "client_id?", "client_name?", "created_at", "updated_at" }], "categories": [{ "slug", "label", "is_custom" }] }`. `categories` is the web picker: Idea, Future, Development, Meeting transcript, plus any custom slugs on that account. Row title falls back to the first body line, then “Untitled”. Subtitle is a truncated body or a relative date. Tap opens the editor (title, body, category, optional client). Plus creates a typed note; the mic still dictates.

```
POST {OZER_API_BASE}/api/native/v1/notes
{ "title?", "body", "workspace", "category?", "tags?", "client_id?" }
```

```
PATCH {OZER_API_BASE}/api/native/v1/notes/{id}
{ "title?", "body?", "category?", "client_id?" }
```

`body` is required on create. `category` must be a system slug or a custom slug for that workspace — do not invent extras. `category` of `meeting_transcript` marks an in-room meeting. `client_id` is optional and must belong to the workspace; `null` on PATCH clears it. Personal and family hide the client picker. New notes reuse `OfflineNoteQueue` so they still save offline. The first ~20 notes (with body) are cached on disk per workspace so a cold launch still opens the list and those details. In-room capture can POST here with `category: meeting_transcript`, or POST `/meetings` for the Ozer Meetings page. The phone never calls `/api/recorder/transcribe-session` (that route is 503; cloud STT is off).

## Meetings API

Same workspace query and error mapping as Tasks (401 / 403 / 404). Writes `meeting_transcripts` — the table the web Meetings page reads.

```
GET {OZER_API_BASE}/api/native/v1/meetings?workspace=<slug-or-uuid>
Authorization: Bearer <access_token>
Accept: application/json
```

The list is `{ "items": [{ "id", "title", "content", "workspace", "client_id", "client_name", "meeting_date", "source", "created_at", "updated_at" }] }`.

```
POST {OZER_API_BASE}/api/native/v1/meetings
{ "title?", "content", "workspace", "client_id", "meeting_date?", "source?", "duration_seconds?" }
```

`content` is Markdown. `client_id` must belong to the workspace (web create also requires a client or deal). `source` of `iphone` is stored as `desktop_recorder` so the existing CHECK holds. `speaker_segments` are parsed when labels exist (`Me: …`).

### Field dictation

Notes has a mic. Hold or tap to dictate a new note. Transcription is **on-device** (Speech framework, `requiresOnDeviceRecognition`, locale `en-GB`). The note is saved locally immediately (title from the first line). If the phone is online it POSTs the native notes API; if not, it queues and flushes on reconnect or next foreground. Failed sync stays on the list as **Waiting to sync**.

### Meetings

Surveyor, studio (`work_design` / `work_property`), and commercial property workspaces get a **Meetings** item in the Menu (the tab bar still has only Home + 3 pins + Menu). Personal and family do not. Record in-room:

- Pause / Resume / Stop on the same meeting. Pause freezes captions, stops Apple Speech, keeps the CAF open, pauses the timer, and runs local diarization on audio so far. Resume starts a new Speech session and keeps appending into the same file. Live captions after resume stay **Me** until the next Pause or Stop. Stop runs a final diarization pass, saves locally, and queues sync.
- Elapsed time, live captions with coloured speaker pills, optional client picker (business workspaces only), screen stays awake
- Background audio mode so a lock-screen meeting is not killed
- Audio stays on the phone as m4a (excluded from iCloud backup) until the user deletes the meeting
- Live captions stay on **Me**. Pause and stop run on-device diarization (pyannote segmentation-3.0 + WeSpeaker ResNet34-LM, ~32 MB downloaded once into Application Support, excluded from iCloud) and label **Me** then **Speaker 1 / Speaker 2**. The same voice can return as Me. Not NVIDIA Sortformer. If models fail, the meeting stays Me-only — it does not invent speakers from short pauses. Mic only — no computer-audio “Them”
- On-device Speech sessions are ended and restarted around 50s so live captions continue; the m4a/caf recording is not restarted. If a restart fails, the meeting screen shows an error and keeps retrying — the timer is not a silent freeze. A rewritten shorter hypothesis does not duplicate a committed paragraph.
- On Stop a save sheet picks **Meeting** or **Note**. Surveyor (`building_surveyor`) defaults to Note; studio / commercial / `work_design` / `work_property` default to Meeting; personal and family are Note only. Meeting requires a client. Note keeps optional `client_id` + `category: meeting_transcript`.
- Meeting syncs `POST /api/native/v1/meetings`. Note syncs `POST /api/native/v1/notes`. Flush errors stay visible; a 400 is not swallowed. Audio stays on the device.
- The Meetings list shows local recordings plus remote `meeting_transcripts`

Linux cannot compile this Xcode project. Open `apps/ios/Ozer.xcodeproj` on a Mac to build.

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

The list is `{ "items": [{ "id", "name", "email", "company_name", "client_type", "image", "logo" }] }`. `name` uses the same display rules as web (`display_name` or first + last). `image` / `logo` are the same public HTTPS company mark (`clients.picture_url`), or null. Tap a client for a logo, company, email, contacts, and that client’s open tasks, plus add-task pre-filled with `client_id`.

```
GET {OZER_API_BASE}/api/native/v1/clients/{id}?workspace=<slug-or-uuid>
```

Detail adds `contacts: [{ id, name, role, email, phone, is_primary }]`, scoped to that client and workspace. Email and phone are tappable (`mailto:` / `tel:`). Personal and family still return an empty list (not 403); a missing client is 404.

## Menu

Workspace picker at the **top** (logo + name). Tap opens `WorkspaceSwitcherView` — memberships are not listed inline. Nav links under the picker follow the selected space: Home, Tasks, Notes always; Meetings on surveyor / studio / commercial spaces; People on personal / family; Clients on business profiles; Shopping stays a stub. Sign out and the email footer stay at the bottom. Switching workspace updates the links and leaves the menu open.

## Tab bar

Matches the web PWA: **Home | 3 pin slots | Menu**. Pins default to Tasks, Notes, People. Shopping is in the Menu and is still a navigation stub.

Out of scope: PowerSync, camera, the Mac Whisper stack, cloud STT / `/api/recorder/transcribe-session`, invoices, secrets, App Store submit, `WKWebView` of the web app.

## Monorepo

`apps/ios` is excluded from `pnpm-workspace.yaml`. `scripts/vercel-ignore.sh` skips **ozer** / **ozer-docs** / **ozer-sites** when the diff is only under `apps/ios/`.
