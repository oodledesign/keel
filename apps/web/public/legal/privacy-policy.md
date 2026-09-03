# Privacy Policy

**Last updated:** 3 September 2026

Oodle Designs Ltd ("Ozer", "we", "us") is the data controller for personal data we process for our own purposes (account and authentication data, product analytics and security logs, and SaaS billing records). Where you use Ozer to store or process your clients', staff, or invitees' personal data, we typically act as a **processor** on your instructions. See our [Data Processing Agreement](/dpa) for that relationship. We comply with the UK GDPR, EU GDPR, and the Data Protection Act 2018.

## What we collect

- Account details: name, email, password hash, workspace membership.
- Workspace content you create: tasks, notes, clients, contacts, invoices, files, and related CRM records.
- Billing data processed by Stripe (we do not store full card numbers).
- Usage, device, and security logs; product analytics events; optional analytics cookies / similar technologies with consent (see Product analytics and [Cookie Policy](/cookie-policy)).
- AI feature inputs and outputs where you use Ozer AI features.
- Optional integration data described in the feature sections below (email, calendar, transcription, activity tracking, signatures, bookings, video).

## Lawful bases

We process data to perform our contract with you, for legitimate interests (security, product improvement), with consent where required (marketing/analytics cookies and similar technologies; meeting recording and activity tracking as described below), and to meet legal obligations (tax, fraud prevention). Where we act as your processor, you are responsible for ensuring you have a lawful basis for the personal data you instruct us to process.

## Core workspace CRM

**Data:** client and contact records (name, email, phone, address, picture), and links to tasks, notes, and projects.

**Purpose:** to run your CRM and workspace so you can manage client relationships.

**UK GDPR basis:** contract performance for account services; where we process as your processor, your instructions apply.

**Sub-processors:** Supabase (primary database, EU West).

**Retention:** for the life of your account. Deleted within 30 days of account termination, except where law requires longer retention.

## Invoicing, proposals, and contracts

**Data:** invoice and document content, recipient emails, templates, document metadata, and secure portal access tokens.

**Purpose:** to bill and contract with your clients, send documents, and enable payment where configured.

**UK GDPR basis:** contract performance / your instructions as controller of client data.

**Sub-processors:** Supabase; ZeptoMail (sending); Stripe (client payments when enabled).

**Retention:** document content follows workspace retention (life of account + 30 days). Records forming part of billing/tax history are retained for 6 years in line with HMRC requirements.

## Email Assistant (Gmail)

**Data:** encrypted OAuth tokens, synced email threads and messages, drafts, and extracted action items.

**Purpose:** to sync your connected mailbox, triage messages, extract tasks, draft replies, and optionally send replies when you explicitly enable send-from-Ozer and confirm each send.

**Google scopes:** `gmail.readonly`, `gmail.modify`, `gmail.settings.basic`.

**UK GDPR basis:** contract performance and your instructions; you must ensure staff/customer email content is processed lawfully.

**Sub-processors:** Google (Gmail API); Anthropic and Google (Gemini API) for AI classification, extraction, and drafting on message text (model route depends on feature).

**Retention:** synced email content and drafts are deleted within 30 days of disconnecting the integration. OAuth tokens are deleted immediately on disconnect.

## Google Calendar

**Data:** calendar connection records and calendar events/attendees accessed via OAuth.

**Purpose:** planner and meeting context, including writing events when you use scheduling features with a connected calendar.

**Google scopes:** `calendar.readonly`, `calendar.events`.

**UK GDPR basis:** contract performance / your instructions.

**Sub-processors:** Google (Calendar API); Supabase.

**Retention:** cached event data is deleted within 30 days of disconnecting the integration. Tokens are deleted immediately on disconnect.

## Public scheduler and bookings

**Data:** invitee name, email, timezone, notes, guests, and form answers (which may include phone numbers), plus secure booking management tokens.

**Purpose:** to run your public booking links and allow invitees to manage bookings.

**UK GDPR basis:** you are typically the controller of invitee data; we process it on your instructions. Our own processing of transactional emails is for contract performance.

**Sub-processors:** Supabase; ZeptoMail; Google Calendar (when connected).

**Retention:** invitee booking records are retained for 24 months after the booking date, then deleted or anonymised, unless you delete them sooner.

## Meeting transcripts and recording

**Data:** transcript text, speaker segments and mappings, attendee emails, summaries, and action items.

**How transcription works:** audio is transcribed on your device by the Ozer Assistant for Mac. Audio is not retained as part of the product model; transcript text is uploaded to your Ozer workspace.

**Consent:** meeting recording and transcription require explicit enablement in the product. You remain responsible for informing meeting attendees as required by law — in-product consent does not replace your attendee notice duties.

**UK GDPR basis:** consent and/or your instructions as controller of attendee data.

**Sub-processors:** Supabase; Anthropic (summaries and action-item extraction where enabled).

**Retention:** transcripts, summaries, and action items are retained until you delete them or your account closes (then deleted within 30 days).

## Activity tracking (Mac Assistant)

**Data:** activity blocks including app name, website domain, optional page URL, window title, and durations. We do **not** capture keystrokes, audio, or screen recordings for this feature.

**Purpose:** day reconstruction and time attribution when you opt in.

**Consent / opt-in:** activity tracking is off by default. Full URL capture is separately off by default. You must explicitly enable tracking.

**UK GDPR basis:** consent / explicit opt-in. If you enable tracking on devices used by your staff, you are responsible for providing them with appropriate notice as their employer.

**Sub-processors:** Supabase only.

**Retention:** activity data is retained on a 12-month rolling window and then deleted, unless you delete it sooner.

## Ozer Signatures

**Data:** staff name, email, job title, department, phone numbers, profile photos, signature HTML, and Microsoft/Google connection tokens. Staff details can be synced from your Microsoft 365 or Google Workspace directory, or entered manually in the app.

**Purpose:** to design and manage email signatures for your organisation's staff. For Microsoft 365, staff install their signature by copying it into Outlook themselves — Ozer does not write to Outlook mailboxes. For Google Workspace, Ozer can apply the signature to Gmail directly when you connect Google Workspace.

**UK GDPR basis:** you are typically the controller of staff data; we process on your instructions. Contract performance for providing the Signatures product.

**Sub-processors:** Supabase (including photo storage); Microsoft Graph (directory sync); Google (directory sync and Gmail signature settings).

**Retention:** staff profile data and photos are deleted within 30 days of disconnecting the Microsoft/Google connection or removing the staff member. Connection tokens are deleted immediately on disconnect.

### Microsoft Entra permissions (administrators)

When an administrator connects Microsoft 365 for Signatures, Ozer requests:

- `User.Read.All` (application) — read staff directory profiles to populate signature details.
- `ProfilePhoto.Read.All` (application) — read profile photos for use in signatures.
- `openid` and `profile` (delegated) — sign in the connecting administrator.

Ozer does **not** request `MailboxSettings.ReadWrite`. Directory sync is read-only: we read profiles and photos to build signatures. We do not read email content and we do not write to Outlook mailboxes or mailbox settings. Staff paste their Outlook signature themselves.

### Google Workspace permissions

- `admin.directory.user.readonly` — read user directory data for staff sync.
- `gmail.settings.basic` — apply the signature to Gmail send-as settings.

## Product analytics (PostHog)

**Data:** page views and in-product events; device and browser information; approximate location derived from IP; referrer/UTM data; performance and error telemetry; and, where you are signed in, a stable user or account identifier (and limited account traits such as plan tier where we choose to send them). We do **not** intentionally send workspace CRM content, email bodies, invoice line items, or meeting transcript text to PostHog as analytics properties.

**Optional session replay:** Session replay is enabled. PostHog stores recordings for **30 days**. Input fields are masked. Replay may still incidentally include on-screen workspace text visible in the UI. Contact privacy@ozer.so with questions about replay settings.

**Purpose:** understand product usage, diagnose bugs, improve features, and measure onboarding and conversion — as controller for product analytics.

**UK GDPR basis:** legitimate interests in operating and improving the service; where cookies or similar technologies require consent under UK/EU ePrivacy rules, we obtain consent via the cookie banner before loading non-essential analytics.

**Sub-processors:** PostHog, Inc. (EU Cloud — see Sub-processors table).

**Retention:** analytics events follow PostHog project retention settings; **session recordings are retained for 30 days**. We may delete or anonymise sooner on request where feasible.

## Platform billing and client payments

**Platform billing data:** billing customer records and subscription status. We do not store card numbers; Stripe processes card payments.

**Client payments (Stripe Connect):** Connect account identifiers, customer identifiers, and bank instruction fields you configure for invoice payment.

**Purpose:** SaaS subscription billing; collecting payment from your clients when you enable Connect.

**UK GDPR basis:** contract performance; legal obligations for tax/accounting.

**Sub-processors:** Stripe; Supabase.

**Retention:** billing and payment records are retained for 6 years in line with HMRC requirements, then deleted.

## AI features

When you use AI features, relevant workspace text is sent to our AI sub-processors to generate responses. We log usage volume and model identifiers for billing purposes; prompt content is not stored in usage logs.

**Providers:** Anthropic (language model features); Google Gemini Flash / Flash-Lite (paid API — high-volume routes such as email triage and extract); Voyage AI (semantic search embeddings).

We do not use your private workspace data to train public foundation models. You should not submit special category data unless you have a lawful basis and appropriate safeguards. AI outputs are assistive and may be inaccurate — you remain responsible for decisions made in your business.

Ozer's use of information received from Google Workspace APIs adheres to the Google API Services User Data Policy, including the Limited Use requirements.

## How we protect your data

We apply technical and organisational measures appropriate to the data we process:

- **Encryption in transit:** all data is transmitted over TLS 1.2 or higher.
- **Encryption at rest:** data is encrypted at rest using AES-256 via our Supabase/AWS infrastructure.
- **OAuth token security:** OAuth access and refresh tokens for Google integrations (including Gmail Email Assistant and Google Calendar) are encrypted at the application layer using AES-256-GCM before storage. Microsoft 365 Signatures connection tokens are stored in our database without a separate application-layer wrap and rely on AES-256 encryption at rest. Tokens are deleted when you disconnect the integration.
- **Access controls:** we use Row-Level Security so workspace data is scoped to the correct account and cannot be accessed across workspaces.
- **Internal access:** access to production data is restricted to authorised personnel on a need-to-know basis.

Further detail is available on our [Trust Centre](/trust).

## Transactional email

**Data:** sender/recipient addresses, subject, message body, and delivery log metadata.

**Purpose:** product and transactional emails (invites, invoices, booking confirmations, etc.).

**Sub-processors:** ZeptoMail (EU data centre) for product mail such as invites and one-time codes; Amazon SES (AWS, EU regions we configure) for workspace sending domains and circulation mailouts once you verify a domain.

**Retention:** delivery logs are retained for 12 months, then deleted.

## Video hosting

**Data:** title, description, filename, hosting identifiers, and media files.

**Purpose:** host and play videos you upload.

**Sub-processors:** Supabase (metadata); Bunny.net (video storage and streaming, EU storage region).

**Retention:** videos and metadata are deleted within 30 days of account closure, or when you delete them.

## Commercial property listings

**Data:** listing particulars and copy; property photographs and other media (including display order); addresses and map coordinates; landlord, co-agent, and branch contact details you record; portal and XML-feed identifiers; public brochure and share tokens.

**Purpose:** to market commercial property from your workspace, generate brochures, and publish to website XML feeds, EACH, and any other portals you enable.

**UK GDPR basis:** you are typically the controller of occupier, landlord, and enquiry data; we process on your instructions.

**Sub-processors:** Supabase; Mapbox (maps and geocoding); Amazon Web Services (SES where you send listing-related mail from a workspace sending domain).

**Retention:** listing content, media, and coordinates are retained for the life of your workspace (then deleted within 30 days of account termination), unless you delete a listing sooner.

## MCP API

If you connect an external AI client via our MCP API, that client can access tasks, projects, deals, clients, and notes within your own workspace permissions. Email message bodies are not exposed via this path. You are responsible for the external MCP client you choose to connect.

## Sub-processors

We use the following sub-processors to operate Ozer. A matching register is published on our [Trust Centre](/trust#sub-processors). We do not list integrations that are not yet shipped.

| Name | Purpose | Data (high level) | Location & transfer mechanism |
| --- | --- | --- | --- |
| Supabase | Database, auth, storage (hosted on AWS EU West) | Workspace and account data | EU West (Ireland) — no restricted transfer |
| Amazon Web Services (AWS) | Amazon SES for workspace sending domains and circulation email; cloud infrastructure underlying EU hosting | Sender/recipient addresses, subject, and body for SES mail; infrastructure for hosted data | EU (Ireland and other AWS EU regions we configure) — no restricted transfer |
| Stripe | SaaS billing and Connect payments | Customer IDs, subscription status; card numbers stay with Stripe | US — Stripe Data Transfers Addendum (UK IDTA incorporated; EU-US Data Privacy Framework incl. UK Extension) |
| Anthropic | AI language model features | Workspace / email / transcript text prompts | US — DPA with EU SCCs and UK Addendum (incorporated in commercial terms); EU-US Data Privacy Framework |
| Google (Gemini Flash / Flash-Lite) | High-volume AI (email triage/extract and other Flash-Lite routes) | Workspace / email text prompts | US/global — Paid Gemini API under Google Data Processing Addendum (EU SCCs and UK Addendum); EU-US Data Privacy Framework (Google LLC). Free AI Studio tier is not used for customer personal data. |
| Google Workspace APIs | Gmail, Calendar, Workspace directory | Mailbox, calendar, and directory data | US/global — Google Data Processing Terms (SCCs and UK Addendum incorporated) |
| Microsoft | Signatures directory sync | Staff profile and photo data | US/global — Microsoft Products and Services Data Protection Addendum (SCCs and UK Addendum incorporated) |
| ZeptoMail (Zoho) | Transactional email | Recipient, subject, message body | EU data centre — Zoho DPA with standard contractual clauses |
| Bunny.net (BunnyWay d.o.o.) | Video hosting and streaming | Media files and video metadata | Slovenia (EU) — EU-headquartered; DPA in place; EU storage region |
| Mapbox | Commercial listing maps and address geocoding | Addresses and map coordinates | US/global — Mapbox Data Processing Agreement (SCCs / UK Addendum as applicable) |
| Voyage AI | Semantic search embeddings | Text excerpts and search queries | US — Voyage AI DPA with EU SCCs and UK ICO Addendum (incorporated in commercial terms) |
| PostHog, Inc. | Product analytics, feature flags, error/session diagnostics, and session replay | Usage events, device/browser data, user/account identifiers; UI session recordings (inputs masked; 30-day recording retention) | EU (PostHog EU Cloud) — PostHog DPA with EU SCCs and UK Addendum |

## International transfers

Primary customer data storage is in AWS EU West (Ireland). Where a sub-processor processes personal data outside the UK/EEA, we rely on the transfer mechanisms listed in the sub-processor table above — UK International Data Transfer Addendum and/or EU Standard Contractual Clauses incorporated into each provider's data processing terms, and, where applicable, the EU-US Data Privacy Framework and its UK Extension.

## Retention & rights

Feature-specific retention periods are stated in the sections above. Ending a subscription does not delete your workspace. On account deletion we remove customer data across our systems within 30 days (database rows are removed immediately; a scheduled job deletes remaining Storage objects at the end of that window). We email the account owner before remaining files are permanently deleted and cannot be recovered, except records we must keep for legal reasons (for example, billing records retained for 6 years for tax purposes).

You may access, rectify, erase, restrict, object, or port your data, and lodge a complaint with the ICO (UK) or your local supervisory authority. Contact: privacy@ozer.so. Step-by-step instructions for deleting your account, disconnecting Instagram / TikTok / Google, and Meta’s data-deletion callback are on our [Data deletion](/data-deletion) page.

Business customers processing personal data through Ozer should also review our [Data Processing Agreement](/dpa).
