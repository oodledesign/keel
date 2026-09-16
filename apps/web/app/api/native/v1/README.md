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

curl -sS "$ORIGIN/api/native/v1/task-review?workspace=YOUR_SLUG" \
  -H "Authorization: Bearer $TOKEN"

curl -sS -X POST "$ORIGIN/api/native/v1/task-review/ITEM_ID/accept" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"workspace":"YOUR_SLUG","source":"meeting","title":"Send the quote"}'

curl -sS -X POST "$ORIGIN/api/native/v1/task-review/ITEM_ID/dismiss" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"workspace":"YOUR_SLUG","source":"email"}'

curl -sS -X POST "$ORIGIN/api/native/v1/tasks" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title":"Call Dan","due":"2026-09-01","workspace":"YOUR_SLUG"}'

curl -sS "$ORIGIN/api/native/v1/notes?workspace=YOUR_SLUG" \
  -H "Authorization: Bearer $TOKEN"

curl -sS -X POST "$ORIGIN/api/native/v1/notes" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title":"Site visit","body":"Me: Hello","workspace":"YOUR_SLUG","category":"meeting_transcript","client_id":"CLIENT_UUID"}'

curl -sS -X PATCH "$ORIGIN/api/native/v1/notes/NOTE_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title":"Site visit","body":"Updated notes","category":"idea","client_id":"CLIENT_UUID"}'

curl -sS "$ORIGIN/api/native/v1/meetings?workspace=YOUR_SLUG" \
  -H "Authorization: Bearer $TOKEN"

curl -sS "$ORIGIN/api/native/v1/meetings/MEETING_ID?workspace=YOUR_SLUG" \
  -H "Authorization: Bearer $TOKEN"

curl -sS -X POST "$ORIGIN/api/native/v1/meetings" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title":"Site visit","content":"Me: Hello","workspace":"YOUR_SLUG","client_id":"CLIENT_UUID","source":"iphone"}'

curl -sS "$ORIGIN/api/native/v1/clients?workspace=YOUR_SLUG" \
  -H "Authorization: Bearer $TOKEN"

curl -sS "$ORIGIN/api/native/v1/clients/CLIENT_ID?workspace=YOUR_SLUG" \
  -H "Authorization: Bearer $TOKEN"

curl -sS "$ORIGIN/api/native/v1/projects?workspace=YOUR_SLUG" \
  -H "Authorization: Bearer $TOKEN"

curl -sS "$ORIGIN/api/native/v1/projects?workspace=YOUR_SLUG&status=all" \
  -H "Authorization: Bearer $TOKEN"

curl -sS "$ORIGIN/api/native/v1/projects/PROJECT_ID?workspace=YOUR_SLUG" \
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

curl -sS "$ORIGIN/api/native/v1/messages?workspace=YOUR_SLUG" \
  -H "Authorization: Bearer $TOKEN"

curl -sS -X POST "$ORIGIN/api/native/v1/messages" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"workspace":"YOUR_SLUG","type":"direct","contact_ids":["CONTACT_UUID"]}'

curl -sS "$ORIGIN/api/native/v1/messages/threads?workspace=YOUR_SLUG" \
  -H "Authorization: Bearer $TOKEN"

curl -sS "$ORIGIN/api/native/v1/messages/compose?workspace=YOUR_SLUG&q=alex" \
  -H "Authorization: Bearer $TOKEN"

curl -sS -X POST "$ORIGIN/api/native/v1/messages/threads" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"workspace":"YOUR_SLUG","type":"direct","member_user_ids":["TEAMMATE_UUID"]}'

curl -sS "$ORIGIN/api/native/v1/messages/threads/THREAD_ID/messages?workspace=YOUR_SLUG" \
  -H "Authorization: Bearer $TOKEN"

curl -sS -X POST "$ORIGIN/api/native/v1/messages/threads/THREAD_ID/messages" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"workspace":"YOUR_SLUG","body":"On my way"}'
```

`workspace` accepts an account slug, UUID, or the chip aliases `personal`, `family`, and `business` (`business` maps to the first `work_design` workspace). Exact slug or UUID wins when they collide with an alias. Personal is always included in `/workspaces` (empty slug falls back to the account id). `/clients` includes `image` / `logo` HTTPS URLs; `GET /clients/:id` adds `contacts`.

`GET /tasks` query flags: `status=open|done|all` (default `open`; portal assignee rows stay out), optional `client=<uuid>`, optional `q` (case-insensitive title match). Personal still hides other people’s life tasks.

## Projects

Shown on `work_design`, `commercial_property`, and `building_surveyor` only (same business profiles as Clients). Personal / family / community get an empty list (not 403). Delivery rows only (`public.projects` with `project_type = delivery`) — no campaign trackers, retainers, or portal publishing.

```
GET /api/native/v1/projects?workspace=<slug-or-uuid>&status=open|done|all
→ {
  "items": [{
    "id", "title", "status", "status_label",
    "client_id", "client_name",
    "start", "due", "is_ongoing", "is_phased",
    "value", "value_pence",
    "progress_pct",
    "task_counts": { "open", "done", "total" }
  }],
  "statuses": [{ "slug", "label", "category": "open"|"completed"|"cancelled" }]
}
```

`status` defaults to `open` (not completed/cancelled, including workspace custom closed slugs). `all` is for the phone board. `statuses` are the workspace columns (defaults when none are seeded). Money uses `formatWorkspaceMoney` (GBP unless a value is stored otherwise). `progress_pct` is the same leaf-task progress as the web project header.

```
GET /api/native/v1/projects/{id}?workspace=<slug-or-uuid>
→ project plus
  "description",
  "phases": [{
    "id", "name", "status", "status_label", "is_milestone", "colour",
    "start", "due", "progress_pct", "task_count"
  }],
  "tasks": [{
    "id", "title", "status", "due", "duration_minutes",
    "client_id", "client_name",
    "phase_id", "phase_name", "parent_task_id", "workspace"
  }],
  "default_board_mode": "phase"|"progress"
```

`default_board_mode` is `phase` when `is_phased` (web Phase / Progress switcher), otherwise `progress` (To do / In progress / Review / Done). Phases are omitted when the project is progress-only. Task `status` matches `/tasks` (`pending`, `in_progress`, `client_review`, `completed`). There is no create / edit / kanban persist on this API — complete or edit a task through `/tasks/{id}`.

## Today

`GET /today` is a pocket dashboard, not the Mac Assistant recorder dump. It returns:

- `greeting`, `date`, `date_label`, optional `message`
- `tasks_due_today` / `overdue_tasks` (same task objects as `/tasks`)
- `recent_notes` (same note objects as `/notes`)
- `meetings_today` (`id`, `title`, `created_at`) on workspaces that record meetings
- `finances` on studio / surveyor / commercial workspaces (or `null`) — invoice outstanding plus this-month in/out and the last 6 months chart series (same as web Home)
- `task_review` — `{ pending_count, meeting_count, email_count }` for the in-app review badge
- `surveyor` — building-surveyor home only (`open_count`, `enquiry_count`, `booked_count`, `surveyed_count`, `recent_surveys`, `pipeline`). `null` on every other workspace
- `items` — flat due-today then overdue, for older clients that still read a list

## Meetings

`GET /meetings` returns recent `meeting_transcripts` plus upcoming confirmed bookings for the workspace:

```
{ "items": [meeting…], "upcoming": [booking…] }
```

List items add `duration_seconds` and `has_extracted_tasks` on top of the existing transcript fields (`id`, `title`, `content`, `client_id`, `client_name`, `meeting_date`, `source`, timestamps). `upcoming` is calendar-style: `id`, `title`, `start_at`, `invitee_name`, `conferencing_url` (max 8, soonest first). A missing bookings table is an empty `upcoming` list, not an error.

`GET /meetings/:id` is the phone detail: the same meeting object plus `notes` (`{ text, generated_at }` from the Mac/web summary, or `null`) and `tasks` (approved / auto-published action items, with `planner_task_id` when a planner task exists).

Site survey sessions store `proposal_id` on `meeting_transcripts` and are omitted from this Meetings list.

## Surveys

Building-surveyor workspaces only. Other profiles get an empty list on GET (not 403). Writes return 400. Surveys are `proposals` with `kind = survey_report`.

```
GET /api/native/v1/surveys?workspace=<slug-or-uuid>
→ { "items": [{ "id", "title", "status", "survey_type", "survey_type_label", "client_id", "client_name", "session_count", "photo_count", "created_at", "updated_at" }] }

POST /api/native/v1/surveys
{ "workspace", "title", "survey_type?", "client_id?" }

GET /api/native/v1/surveys/{id}?workspace=<slug-or-uuid>
→ survey plus "sessions", "photos" (signed preview URLs), and "sections"
  (on-site L2/L3 catalogue with accumulated `note` and `photo_count`).
  Sessions and photos include `rics_code` / `section_key` when tagged.

POST /api/native/v1/surveys/{id}/sessions
JSON { "workspace", "title?", "content?", "duration_seconds?", "meeting_date?", "source?", "rics_code?" }
or multipart fields plus optional audio `file`.
When `rics_code` (or `section_key`) is set, the surveyor-chosen section is used:
the session is attached to that code and the running `survey_observations` note
is created or appended. AI does not assign the section.
Without `rics_code`, the legacy keyword/AI grouping path remains.
In both cases a light-tier cleanup pass strips filler without changing the section.

POST /api/native/v1/surveys/{id}/photos
multipart `workspace` + image `file` + optional `rics_code` / `section_key`
→ survey library doc (`photo_role = archive`, `pinned_section_key` when tagged).
Uploaded bytes are the report-bound copy. Higher-resolution originals stay on
the iPhone when the client compresses before upload.
```

## Task review

Pending extracted tasks from **meetings** (`meeting_action_items.status = pending_review`) and **email** (`email_action_items.status = suggested`). Same accept / edit / dismiss idea as the web review queues. Cookie-free Bearer JSON.

```
GET /api/native/v1/task-review?workspace=<slug-or-uuid>&source=all|meeting|email
→ {
  "items": [{
    "id", "source": "meeting"|"email", "title", "detail", "snippet",
    "due", "duration_minutes", "client_id", "client_name",
    "project_id", "project_name", "context_title", "context_date", "created_at"
  }],
  "meeting_count", "email_count", "pending_count"
}

POST /api/native/v1/task-review/{id}/accept
{ "workspace", "source": "meeting"|"email", "title?", "detail?", "due?", "duration_minutes?", "client_id?" }
→ { "ok": true, "task_id" }

POST /api/native/v1/task-review/{id}/dismiss
{ "workspace", "source": "meeting"|"email" }
→ { "ok": true, "id" }
```

`source` on GET defaults to `all`. Accept creates a planner task (meeting items use the signed-in user as assignee). Optional fields on accept override the suggestion before publish. Dismiss marks email items `dismissed` and meeting items `rejected`. Personal email items include rows with a null `account_id` or this personal account; team workspaces only show that account’s rows.

Email items are scoped to the signed-in user. Meeting items are scoped to the workspace. A 404 means the suggestion is gone or already reviewed.

## Invoices / finances

Shown on `work_design`, `commercial_property`, and `building_surveyor` only. Personal / family / community get an empty list / zeroed pocket (not 403). Archived invoices are excluded. Money is formatted with `formatWorkspaceMoney` (totals in pence).

`GET /invoices` query flags: `status=open|paid|overdue|all` (default `open`). `open` is issued unpaid (`sent`, `read`, `overdue`). Newest `created_at` first.

List fields: `id`, `number`, `client_name`, `status`, `due`, `total`, `total_pence`, `balance`, `balance_pence`, `currency`.

`GET /invoices/:id` adds `issued`, `paid`, `lines` (`description` + `amount`), `url` (hosted portal when `public_token` exists), and `web_path` (`/home/{slug}/invoices/{id}`).

`GET /finances` is the pocket overview: outstanding invoices plus the same **this calendar month** income / outgoings totals as the web business Home dashboard (`finance_transactions`, transfers excluded). `months` is the last 6 months including the current month (major currency units, `outgoings` = web `expenses`). Also: overdue count + amount, paid this month when any paid invoices fall in the current UTC month, and the 5 most recent invoices.

There is no create / edit / PDF / Stripe checkout on this API.

## Messages

Same bearer auth and `workspace` query/body as Tasks. Participant-only: the caller must be on the thread. `job_id` is an Ozer **project** UUID (`public.projects.id`), not a legacy `jobs` row.

```
GET /api/native/v1/messages?workspace=<slug-or-uuid>&limit=40&client=<optional-client-uuid>
→ { "items": [thread…] }

POST /api/native/v1/messages
{ "workspace", "type": "direct"|"group"|"job"|"client", "title?", "job_id?", "client_id?", "member_user_ids?", "contact_ids?" }
→ { "ok": true, "thread_id": "<uuid>" }
```

`type=direct` needs exactly one other person (`member_user_ids` or `contact_ids`). `type=job` needs `job_id` (project). `type=client` needs `client_id` (whole-client / portal contacts).

Thread list items are snake_case (`id`, `account_id`, `type`, `title`, `job_id`, `client_id`, `unread_count`, `last_message_preview`, `participants`, …). Messages use `id`, `thread_id`, `sender_user_id`, `body`, `image_url`, `created_at`, `sender_label`, `attachments`.

```
GET /api/native/v1/messages/{threadId}?workspace=<slug-or-uuid>&limit=50&before=<iso>
→ { "items": [message…] }

POST /api/native/v1/messages/{threadId}
{ "workspace", "body?", "image_url?", "attachments?": [{ "type": "note"|"doc", "id", "title" }] }
→ message object

GET /api/native/v1/messages/{threadId}/attachable?workspace=<slug-or-uuid>
→ { "items": [{ "type", "id", "title", "isPublic" }] }

POST /api/native/v1/messages/upload-image
Authorization: Bearer
Content-Type: multipart/form-data
workspace, thread_id, file
→ { "image_url": "<https url>" }
```

Errors are `{ "error": string }` with 400 / 401 / 403 / 404. The web inbox still uses cookie server actions; native clients should call these routes only. This PR does not add an iOS/Mac inbox — only the bearer JSON contract.

## APNs (iPhone push)

Separate from browser VAPID (`/api/push`). The iPhone POSTs its device token after sign-in:

```
POST /api/native/v1/devices
{ "token": "<64-char hex>", "platform": "ios", "workspace": "<optional slug>" }
```

Rows live in `native_device_tokens` (RLS: a user can upsert their own tokens). The server sends an APNs alert when it already creates an in-app invoice notification (paid, overdue, viewed), and when a new chat message is inserted for other thread participants (never the sender). Failures are logged and never break email or in-app. Invoice deep link: `so.ozer.app://invoice/{id}` plus `invoice_id`. Message deep link: `so.ozer.app://message/{threadId}` plus `thread_id`.

## Messages

Participant-only inbox — same `MessagesService` / `chat_threads` as the web app. A user only sees threads they belong to.

```
GET /messages/threads?workspace=<slug-or-uuid>
GET /messages/threads/{id}?workspace=<slug-or-uuid>
GET /messages/threads/{id}/messages?workspace=<slug-or-uuid>&before=&limit=
POST /messages/threads
{ "workspace", "type?": "direct|group|job|client", "title?", "job_id?", "client_id?", "member_user_ids?", "contact_ids?" }
POST /messages/threads/{id}/messages
{ "workspace", "body?", "image_url?" }
POST /messages/threads/{id}/read
{ "workspace" }
GET /messages/compose?workspace=<slug-or-uuid>&q=
POST /messages/images  (multipart: workspace, threadId, file)
```

`GET /compose` returns teammates, contacts, clients, and projects for New chat search. Image uploads must already be a thread participant.

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

## Recipes / meal plan / shopping

Cookie-free Bearer JSON for the iPhone family meal surfaces. Personal workspaces read the personal library (`account_id` null). Family team workspaces use that account’s shared recipes, plan, and list.

```
GET /api/native/v1/recipes?workspace=<slug-or-uuid>
→ { "items": [{ id, name, description, image_url, meal_type, prep_minutes, cook_minutes, servings, is_favorite, diet_tags, tags, last_cooked_at, times_cooked }] }

GET /api/native/v1/recipes/{id}?workspace=<slug-or-uuid>
→ recipe plus ingredients, instructions, steps, structured_ingredients

GET /api/native/v1/meal-plan?workspace=<slug-or-uuid>&week=YYYY-MM-DD
→ { week_start, dates, members, entries: [{ id, plan_date, meal_type, title, recipe_id, cook_member_id, cook_member_name, is_batch_prep, leftover_source_entry_id, dietary_warnings }] }
Dietary warnings use recipe diet tags plus ingredient text.

GET /api/native/v1/shopping?workspace=<slug-or-uuid>&week=YYYY-MM-DD
→ { week_start, list: { id, skipped_meals, generated_at, items: [{ id, display_text, category, checked, in_pantry, excluded }] } | null }

PATCH /api/native/v1/shopping/items/{id}
{ "workspace", "checked": true }
→ { ok, id, checked }
```

`week` is Monday `YYYY-MM-DD` and defaults to the current week. Shopping ticks use the same list as the web app. Recipes and meal plan are read-only on the phone in this MVP.

## Apple Sign In (optional)

Web OAuth shows Apple only when `NEXT_PUBLIC_AUTH_APPLE=true`. Configure the Apple **Services ID** in the Supabase Auth Apple provider (dashboard). Use `NEXT_PUBLIC_APPLE_SERVICE_ID` as the public Services ID if the native app needs it — do not put the Apple secret in this repo. Google OAuth is unchanged.
