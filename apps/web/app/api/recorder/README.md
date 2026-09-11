# Recorder API (Mac Assistant)

Cookie-free JSON for the Mac Assistant. Authenticate with a `keel_` device token (`Authorization: Bearer …`). Do not use Makerkit cookies here.

## Today

`GET /api/recorder/today`

Optional `account_id` prefers that team workspace for finance / meeting-review deep-links. The token’s `account_id` is used when the query param is omitted (Mac connect tokens are usually the personal account).

Existing fields (`date`, task lists, planner paths) are unchanged. Two optional blocks:

### `finance`

Last ~6 calendar months of **income vs outgoings**, same source as the business workspace dashboard (`finance_transactions` via `loadFinanceDashboardSummary` / `aggregateTransactionsByMonth`). Amounts are major currency units for the grouped bar chart; current-month totals are also in pence.

`null` when the user has no team workspace with real finance rows. Empty months inside the window are zeros (no transactions that month), not invented metrics.

### `triage`

Email + task review counts when those features exist for the user:

- **Email** — `google_connections` + `email_threads` for the personal mailbox, or business if personal is not connected. Categories: `reply_now`, `reply_later`, `waiting`, plus suggested email tasks.
- **Tasks** — suggested email action items (`email_action_items.status = suggested`) and meeting items pending review (`meeting_action_items.status = pending_review`).

`null` when no mailbox is connected **and** there are no suggested/meeting-review items, or those tables are unavailable. Recorder auth is user-scoped via the admin client, so email triage **is** readable without a session cookie.

## Messages

Mac Assistant also polls these cookie-free aliases (same `keel_` bearer token as Today):

`GET /api/recorder/messages`
`GET /api/recorder/messages/threads`

Both return `{ "items": [thread…] }` using the native messages thread list. Optional query: `workspace` or `account_id` (defaults to the token account), `limit`, `client`. Write/send stays on `/api/native/v1/messages`.

## Chrome extension

The unpacked Chrome extension (`apps/ozer-extension`) uses the same `keel_` tokens. Companion routes live at `/api/extension/v1` (capture, speaker-event buffer, extract-tasks). Live speaker stamps into the current transcript still need the local Assistant HTTP endpoint documented in `apps/ozer-extension/README.md`.
