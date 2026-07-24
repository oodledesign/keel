# Ozer — Data processing inventory (Prompt 0)

**Status:** Audit only. No policy prose.  
**Generated from:** `apps/web`, `packages/*`, `supabase/migrations`, and `/Users/danjamespotter/OzerAssistant` (Swift).  
**Last audited:** 24 July 2026  
**Composio:** Not built — exclude from compliance copy until shipped.

---

## Summary table

| Feature | Data touched | Purpose | Storage | Third parties / SDKs | Status |
|---------|--------------|---------|---------|----------------------|--------|
| Core workspace CRM | `clients` (name, email, phone, address, picture); `contacts` / `client_contacts`; tasks/notes/projects links | Run customer’s CRM/workspace | Supabase `public` (EU West per trust copy) | None for storage | Live |
| Invoicing / proposals / contracts | Invoice + recipient emails, email templates, PDF metadata; portal tokens | Bill & contract clients | Supabase; PDFs generated in-app | Stripe Connect (payment); ZeptoMail (send) | Live |
| Gmail Email Assistant | OAuth tokens (AES-256-GCM via `@kit/google-auth`); `email_threads`, `email_messages` (**body_text/body_html**); drafts; action items | Sync mailbox, triage, extract, draft | Supabase + Google | Gmail scopes: `gmail.readonly`, `gmail.modify`, `gmail.settings.basic`; Anthropic Sonnet for classify/extract/draft (thread text, not HTML) | Live |
| Google Calendar | Calendar events/attendees via calendar OAuth | Planner / meeting context | Supabase connection rows + Google | `calendar.readonly`, `calendar.events` | Live |
| Public scheduler | `bookings.invitee_name/email/timezone/notes`, guests, form answers (incl. phone), `management_token` | Public booking / manage links | Supabase; emails via ZeptoMail | Google Calendar write when connected | Live |
| Meeting transcripts | `meeting_transcripts.content`, speaker segments/mappings, attendee emails; summaries/action items | Meeting memory & tasks | Supabase | **Keel web:** Soniox cloud STT (`stt-rt-v5`); **OzerAssistant Mac:** WhisperKit on-device + SpeakerKit diarisation local; transcript text uploaded to Ozer | Live (both paths) |
| Activity tracking | `activity_blocks`: app_name, bundle_id, domain, optional url, **window_title**, durations; **no keystrokes/audio/screens** | Day reconstruction / time attribution | Supabase; `tracking_enabled` **defaults false** | None beyond Ozer backend | Live, opt-in |
| Ozer Signatures | Staff: name, email, job title, dept, phones, photos; signature HTML; MS/Google tokens | Deploy email signatures | Supabase `signatures.*` + `signatures-photos` | **MS Graph:** `MailboxSettings.ReadWrite`, `User.Read.All`, `ProfilePhoto.Read.All`, `offline_access`; **Google:** `admin.directory.user.readonly`, `gmail.settings.basic`. Gmail sendAs push live; Outlook Graph HTML push placeholder | Live (Google push); MS profile sync live |
| Platform billing | `billing_customers`, subscription status — **no PAN** | SaaS subscription | Supabase + Stripe | Stripe Checkout/Portal | Live |
| Client payments (Connect) | Connect account IDs, customer IDs, bank fields on payment settings | Invoice Pay Now / bank instructions | Supabase + Stripe Connect | Stripe Connect | Live |
| AI (non-email) | Workspace text for Site Studio, Brain, proposals, meetings, Rankly, etc. | Feature outputs | Prompt/content not in credit log; `ai_credit_transactions` logs tokens/model only | Anthropic Haiku/Sonnet; Gemini Flash-Lite **configured but unwired** for triage; Voyage embeddings when keyed | Mostly live; Gemini unwired |
| Transactional email | to/from/subject/html; `platform_email_log` metadata | Product emails | ZeptoMail EU API (+ optional Resend) | ZeptoMail (default) | Live |
| Video hosting | title, description, filename, Bunny IDs | Host/play videos | Supabase metadata + Bunny Stream binary | Bunny.net | Live |
| MCP (`/api/mcp`) | Tasks, projects, deals, clients, notes (RLS-scoped) — **not** email bodies | External AI clients | Same Supabase | Customer’s MCP client | Live |
| Composio | — | — | — | — | **Not built** |

---

## Controller vs processor

| Role | Examples |
|------|----------|
| **Ozer as controller** | Account/auth, product analytics/logs, SaaS billing customer records |
| **Ozer as processor** | Customer workspace CRM, email content, signatures on customer staff mailboxes, booking invitee data collected for the customer’s scheduling |

---

## Exact scopes & security notes

### Gmail Email Assistant
- `https://www.googleapis.com/auth/gmail.readonly`
- `https://www.googleapis.com/auth/gmail.modify`
- `https://www.googleapis.com/auth/gmail.settings.basic`
- Source: `apps/web/lib/email-assistant/constants.ts`

### Google Calendar
- `calendar.readonly`, `calendar.events`
- Source: `apps/web/lib/integrations/google-calendar/oauth.ts`

### Microsoft Graph (Signatures — Entra consent)
- Delegated: `MailboxSettings.ReadWrite`, `User.Read.All`, `ProfilePhoto.Read.All`, `offline_access`
- App token: `https://graph.microsoft.com/.default`
- Source: `apps/web/app/api/signatures/ms-auth/route.ts`, `apps/web/lib/signatures/graph.ts`

### Google Workspace (Signatures)
- `https://www.googleapis.com/auth/admin.directory.user.readonly`
- `https://www.googleapis.com/auth/gmail.settings.basic`
- Source: `apps/web/lib/signatures/google-workspace.ts`

### Token encryption
- AES-256-GCM for Google/calendar/conferencing/video secrets via `TOKEN_ENCRYPTION_KEY` / `GOOGLE_TOKEN_ENC_KEY`
- Note: `signatures.ms_connections` tokens appear stored without the same AES-GCM helper (inventory gap for security narrative)

### Activity tracking defaults
- `tracking_enabled` default **false**
- `capture_full_urls` default **false**
- Captures: app name, bundle id, domain, optional URL, window title, duration
- Does **not** capture: keystrokes, audio, screen recording (OzerAssistant consent copy)

### STT
- On-device: WhisperKit + SpeakerKit in OzerAssistant Swift app
- Cloud (keel web session API): Soniox `stt-rt-v5`
- Transcript **text** persisted in Supabase regardless of STT path

### Retention
- No automated purge/TTL jobs found for clients, transcripts, activity_blocks, or bookings
- Billing cancel path: status only; comment says confirm retention before delete
- Flag for policy: **TBD — needs a business decision**

### International transfers
- Anthropic / Google Gemini processing may occur outside UK/EEA
- Transfer mechanism: **TBD — pending legal review** (do not assert SCCs/UK IDTA without confirmation)

---

## Sub-processors to list on Trust Centre (missing as formal register)

| Name | Purpose | Data categories (high level) | Location note |
|------|---------|------------------------------|---------------|
| Supabase / AWS | Primary database, auth, storage | All workspace & account data | EU West (Ireland) per trust copy |
| Stripe | SaaS billing + Connect payments | Customer IDs, subscription status; card PAN stays with Stripe | Stripe (UK/EU entities as applicable) |
| Anthropic | LLM features | Workspace/email/transcript text prompts | [LEGAL REVIEW NEEDED: processing location / transfer tool] |
| Google (Gmail, Calendar, Workspace APIs; Gemini if enabled) | Email/calendar/signatures; future Flash-Lite | Mailbox/calendar/directory; AI prompts if wired | [LEGAL REVIEW NEEDED] |
| Microsoft Graph | Signatures directory + mailbox settings | Staff profile, photo, mailbox settings | [LEGAL REVIEW NEEDED] |
| ZeptoMail | Transactional email | Recipient, subject, HTML body | EU API endpoint used in code |
| Bunny.net Stream | Video hosting | Media files + video metadata | [LEGAL REVIEW NEEDED: region] |
| Voyage AI | Embeddings (Second Brain) when keyed | Chunk/query text | [LEGAL REVIEW NEEDED] |
| Soniox | Cloud realtime STT (web recorder path) | Audio stream / transcript | [LEGAL REVIEW NEEDED] |

**Exclude until shipped:** Composio.

---

## Trust Centre gap

File: `apps/web/app/(marketing)/trust/page.tsx` — no dedicated Sub-processors section. Stripe/Supabase mentioned in prose only.
