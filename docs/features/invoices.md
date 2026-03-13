# Invoices V1

Invoices allow the org to bill clients for work (optionally linked to jobs). Clients can view and pay via a secure token-based portal link. Payment is collected via Stripe Checkout; invoice status is updated from webhooks. Audit events record create, update, and send.

## Roles and access (V1)

- **Owner / Admin / Staff:** Full CRUD on invoices and line items within the org. Owner/Admin only for delete. Can send invoice (generates portal link + email), download PDF, create Stripe Checkout session.
- **Contractor:** No access to invoices in V1.
- **Client:** No dashboard access. View and pay only via **portal link** (`/portal/invoices/[token]`); no login required.

## Status (enum)

- `draft` — Editable; not sent. Invoice number is already assigned at creation (from org counter).
- `sent` — Sent to client (portal link emailed). Awaiting payment.
- `paid` — Paid (Stripe Checkout completed; webhook updates status and `paid_at`).
- `overdue` — Due date passed and status is `sent`; **V1: computed in UI only** (no background job).
- `cancelled` — Voided; no longer payable.

Transitions: draft → sent → paid; draft/sent → cancelled.

## Numbering

- **Invoice number** is allocated when the invoice is **created** (draft), using an org-scoped counter so every invoice has a number from the start.
- Format: org-scoped sequence, e.g. `INV-0001`, `INV-0002` per account. Stored in `invoices.invoice_number` (unique per account).
- **Counter table:** e.g. `invoice_counters(account_id, next_number)` or single row per account; use a transaction (e.g. `SELECT FOR UPDATE`) to allocate the next number and increment. Ensures uniqueness per org.

## Data model (tables)

### invoice_counters (org-scoped numbering)

| Column        | Type    | Notes |
|---------------|---------|--------|
| account_id    | uuid    | PK, FK → accounts(id) ON DELETE CASCADE |
| next_number   | integer | NOT NULL, default 1 |

Allocate next number in a transaction when creating an invoice; increment `next_number`. Unique per account.

### invoices

| Column                      | Type         | Notes |
|-----------------------------|--------------|--------|
| id                          | uuid         | PK |
| account_id                  | uuid         | NOT NULL, FK → accounts(id) ON DELETE CASCADE |
| client_id                   | uuid         | NOT NULL, FK → clients(id) ON DELETE RESTRICT |
| invoice_number              | text         | NOT NULL, unique per account (e.g. INV-0001) |
| status                      | text         | draft \| sent \| paid \| overdue \| cancelled |
| due_at                      | timestamptz  | Nullable |
| subtotal_pence              | integer      | NOT NULL; sum of line items |
| total_pence                  | integer      | NOT NULL; same as subtotal for V1 (no tax) |
| currency                    | text         | Default 'gbp' |
| notes                       | text         | Nullable |
| public_token                | text         | Unique token for portal link (set when sent) |
| issued_at                   | timestamptz  | Set when sent |
| sent_at                     | timestamptz  | Set when sent |
| sent_to_email               | text         | Email used when sending |
| paid_at                     | timestamptz  | Set when payment succeeds |
| stripe_checkout_session_id  | text         | Nullable; Stripe Checkout Session id |
| stripe_payment_intent_id    | text         | Nullable; from webhook for reconciliation |
| created_by                  | uuid         | FK → auth.users |
| created_at, updated_at      | timestamptz  | |

Indexes: `(account_id, status)`, `(account_id, invoice_number)`, `(client_id)`, `(public_token)` unique. Constraint: `status` in (draft, sent, paid, overdue, cancelled).

### invoice_items

| Column            | Type    | Notes |
|-------------------|---------|--------|
| id                | uuid    | PK |
| account_id        | uuid    | NOT NULL, FK → accounts |
| invoice_id        | uuid    | NOT NULL, FK → invoices(id) ON DELETE CASCADE |
| job_id            | uuid    | Nullable, FK → jobs(id) ON DELETE SET NULL |
| sort_order        | integer | NOT NULL; preserve display order |
| description       | text    | NOT NULL |
| quantity          | integer | NOT NULL, default 1 |
| unit_price_pence  | integer | NOT NULL |
| total_pence       | integer | NOT NULL (quantity * unit_price_pence) |

Indexes: `(account_id, invoice_id)`, `(invoice_id)`. Recalculate `invoices.subtotal_pence` / `invoices.total_pence` server-side on upsert (or trigger).

### invoice_events (audit log)

| Column       | Type        | Notes |
|--------------|-------------|--------|
| id           | uuid        | PK |
| account_id   | uuid        | NOT NULL, FK → accounts |
| invoice_id   | uuid        | NOT NULL, FK → invoices(id) ON DELETE CASCADE |
| event_type   | text        | e.g. created, updated, status_changed, sent |
| payload      | jsonb       | Optional (e.g. old/new status, sent_to_email) |
| created_at   | timestamptz | |
| actor_id     | uuid        | FK → auth.users, nullable |

Indexes: `(account_id, invoice_id)`, `(invoice_id, created_at)`. Used for create/update/status/send audit.

## RLS and permissions

- Add permissions: `invoices.view`, `invoices.edit`. Owner, Admin, Staff get both; Contractor and Client get neither.
- **invoices:** RLS. SELECT/INSERT/UPDATE for users with `invoices.edit` (or view) on row’s `account_id`. **DELETE: Owner/Admin only.** Contractor/Client no access.
- **invoice_items, invoice_events:** Same org scope; only users with `invoices.edit` (or view for SELECT) on the invoice’s account. No Contractor/Client.
- **invoice_counters:** RLS; only users with `invoices.edit` can SELECT/UPDATE for their account (used during create).
- **Portal:** No RLS on tables for portal. Use a **server-only** endpoint/action that returns one invoice by `public_token` only; no auth. Do not expose other invoices.

## Portal link and send flow

- **Send invoice:** Generate secure random `public_token` if not set. Set status = sent, `issued_at`, `sent_at`, `sent_to_email`. Email client with link: `/portal/invoices/[token]`. Log `invoice_events` event_type = sent.
- **Portal URL:** `/portal/invoices/[token]`. Public; load invoice by `public_token` only. Read-only view; “Download PDF” and “Pay now” (if payable). Token must be unguessable; optional expiry not required for V1.

## PDF

- Generate PDF on demand (dashboard or portal “Download PDF”). Prefer **Playwright** (render invoice HTML to PDF) or another reliable method. Return downloadable response or upload to Supabase Storage and return signed URL. Layout must match invoice (org, client, number, dates, line items, totals). Optional: cache by invoice_id/updated_at for V1.

## Stripe Checkout

- **createInvoiceCheckoutSession(invoiceId):** Verify invoice belongs to current org and is payable (status sent, not paid/cancelled). Create Stripe Checkout Session with amount = invoice total (or line items); metadata: invoice_id, account_id. success_url / cancel_url back to portal invoice page. Store `stripe_checkout_session_id` on invoice.
- **Webhook:** Handle `checkout.session.completed` and/or `payment_intent.succeeded`. Verify signature. Mark invoice paid: status = paid, set `paid_at`, store `stripe_payment_intent_id`. **Idempotency:** do not double-process (e.g. check status before updating).
- Portal: show “Pay now” if sent and not paid; show “Paid” and paid_at when paid.

## UI routes (app)

- **List:** `/home/[account]/invoices` — Table: invoice_number, client, job (optional), total, due date, status, updated_at. Search and pagination; filter by status. “Create new invoice” → create draft (allocate number, empty items) then navigate to `/home/[account]/invoices/[id]/edit`. Nav item “Invoices” (Owner/Admin/Staff).
- **Edit (builder):** `/home/[account]/invoices/[id]/edit` — Invoice preview/editor: bill-to, dates, invoice number, line items table (add/remove/edit rows; description, qty, unit price; totals updated client-side optimistically, server as source of truth). Sidebar/top: Save, Send, Download PDF, Create payment link. Client required, job optional (filtered by client). Use server actions for save and upsertInvoiceItems; loading/error states and toasts.
- **Portal (public):** `/portal/invoices/[token]` — Load by `public_token`. Read-only invoice view; “Download PDF”, “Pay now” (if payable). After payment, show “Paid” state or thank-you.

## Overdue (V1)

- **Definition:** Invoice is overdue if `due_at < now()` and status = sent.
- **Implementation:** Query-time or UI-computed only (e.g. badge on list/detail). No cron or background job for V1.

---

## Implementation tasks (dependency order)

**1. Migrations: tables and counter (no RLS)**  
Create in order: `invoice_counters` (account_id PK, next_number); `invoices` (all columns above, indexes, status constraint); `invoice_items` (with sort_order, indexes); `invoice_events` (event_type, payload, indexes). Use pence fields; timestamps. Do not add RLS yet.

**2. Migrations: permissions**  
Add `invoices.view` and `invoices.edit` to `app_permissions` enum. Seed role_permissions for Owner, Admin, Staff (both). Contractor/Client get neither.

**3. Migrations: RLS**  
Enable RLS on `invoices`, `invoice_items`, `invoice_events`, `invoice_counters`. Policies: Owner/Admin/Staff full CRUD within org (DELETE on invoices: Owner/Admin only). Contractor: no access. Client: no access. Enforce account_id on insert/update; prevent cross-org reads/writes. Use existing `has_permission` / role patterns.

**4. Backend: invoice numbering**  
Transaction-safe allocation: from `invoice_counters` get next_number for account_id (SELECT FOR UPDATE), format as invoice_number (e.g. INV-0001), increment next_number, return. Used when creating a new invoice.

**5. Backend: invoice service**  
CRUD; list with pagination (page, pageSize), query (search), status filter; get by id (with items, client, job); get by public_token only (for portal, no auth). computeTotals(invoiceId) helper to recalc subtotal_pence/total_pence from items. Enforce permissions via RLS (authenticated client).

**6. Backend: server actions**  
Zod validation, typed returns, user-friendly errors; no service_role on client.  
- `listInvoices({ page, pageSize, query, status? })`  
- `getInvoice(invoiceId)` — include items, client, job  
- `createInvoice({ client_id, job_id?, due_at?, notes? })` — allocate invoice_number from counter, create draft with empty items, log invoice_events “created”  
- `updateInvoice(invoiceId, fields)` — log “updated”  
- `deleteInvoice(invoiceId)` — Owner/Admin only  
- `upsertInvoiceItems(invoiceId, items[])` — preserve sort_order, recalc totals server-side  
- `setInvoiceStatus(invoiceId, status)` — e.g. cancel; log “status_changed”  
- `getInvoiceForPortal(token)` — return single invoice by public_token; no auth

**7. Backend: send invoice**  
“Send invoice” flow: ensure public_token set (generate if not), set status = sent, issued_at, sent_at, sent_to_email. Email client with link `/portal/invoices/[token]` (use existing email integration or stub with TODO). Log invoice_events “sent”.

**8. UI: nav + list page**  
Add “Invoices” nav item → `/home/[account]/invoices`. List page: table (invoice_number, client, job, total, due date, status, updated_at), search, pagination, status filter. “Create new invoice” creates draft then redirects to `/home/[account]/invoices/[id]/edit`. Use existing UI components/patterns.

**9. UI: invoice builder (edit page)**  
`/home/[account]/invoices/[id]/edit`: layout like an invoice (bill-to, dates, invoice number, line items table). Line items: add/remove row, edit description/qty/unit price; totals update (optimistic + server source of truth). Client (required) and Job (optional, filtered by client) selectors. Actions: Save, Send, Download PDF, Create payment link. Server actions for save and upsertInvoiceItems; loading/error states and toasts.

**10. UI: portal invoice page**  
`/portal/invoices/[token]`: load by public_token only; read-only invoice view (same structure as builder preview). “Download PDF” and “Pay now” (if not paid). Do not reveal other invoices. Simple styling consistent with product.

**11. PDF generation**  
Server action or API: generate PDF from invoice (Playwright preferred: render invoice HTML to PDF, or other reliable method). Return download or store in Supabase Storage and return signed URL. Optional caching (e.g. by invoice_id/updated_at) for V1.

**12. Stripe: create Checkout session**  
Server action `createInvoiceCheckoutSession(invoiceId)`: verify org and payable (sent, not paid/cancelled). Create Stripe Checkout Session; success/cancel URLs to portal page. Store stripe_checkout_session_id on invoice. Follow existing Stripe patterns in repo.

**13. Stripe: webhook and idempotency**  
Handle `checkout.session.completed` and/or `payment_intent.succeeded`: verify signature; set invoice status = paid, paid_at, stripe_payment_intent_id. Idempotent (e.g. skip if already paid). Update portal page to show “Paid” when paid.

**14. Overdue (V1)**  
Compute overdue in UI only: due_at < now and status = sent. Show as badge or column on list/detail; no cron.
