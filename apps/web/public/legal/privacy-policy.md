# Privacy Policy

**Last updated:** [DATE]

Oodle Designs Ltd ("Ozer", "we", "us") is the data controller for personal data we process for our own purposes (account and authentication data, product analytics and security logs, and SaaS billing records). Where you use Ozer to store or process your clients', staff, or invitees' personal data, we typically act as a **processor** on your instructions. See our [Data Processing Agreement](/dpa) for that relationship. We comply with the UK GDPR, EU GDPR, and the Data Protection Act 2018.

## What we collect

- Account details: name, email, password hash, workspace membership.
- Workspace content you create: tasks, notes, clients, contacts, invoices, files, and related CRM records.
- Billing data processed by Stripe (we do not store full card numbers).
- Usage, device, and security logs; optional analytics cookies with consent.
- AI feature inputs and outputs where you use Ozer AI features.
- Optional integration data described in the feature sections below (email, calendar, transcription, activity tracking, signatures, bookings, video).

## Lawful bases

We process data to perform our contract with you, for legitimate interests (security, product improvement), with consent where required (marketing/analytics cookies; meeting recording and activity tracking as described below), and to meet legal obligations (tax, fraud prevention). Where we act as your processor, you are responsible for ensuring you have a lawful basis for the personal data you instruct us to process.

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

**Purpose:** to sync your connected mailbox, triage messages, extract tasks, and draft replies when you use those features.

**Google scopes:** `gmail.readonly`, `gmail.modify`, `gmail.settings.basic`.

**UK GDPR basis:** contract performance and your instructions; you must ensure staff/customer email content is processed lawfully.

**Sub-processors:** Google (Gmail API); Anthropic (AI classification, extraction, and drafting on message text).

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
- `User.Read` (delegated) — sign in the connecting administrator.
- `offline_access` — maintain the connection without repeated re-consent.

Ozer's Microsoft access is read-only: we read directory profiles and photos to build signatures. We do not read email content and we do not write to mailboxes or mailbox settings.

### Google Workspace permissions

- `admin.directory.user.readonly` — read user directory data for staff sync.
- `gmail.settings.basic` — apply the signature to Gmail send-as settings.

## Platform billing and client payments

**Platform billing data:** billing customer records and subscription status. We do not store card numbers; Stripe processes card payments.

**Client payments (Stripe Connect):** Connect account identifiers, customer identifiers, and bank instruction fields you configure for invoice payment.

**Purpose:** SaaS subscription billing; collecting payment from your clients when you enable Connect.

**UK GDPR basis:** contract performance; legal obligations for tax/accounting.

**Sub-processors:** Stripe; Supabase.

**Retention:** billing and payment records are retained for 6 years in line with HMRC requirements, then deleted.

## AI features

When you use AI features, relevant workspace text is sent to our AI sub-processors to generate responses. We log usage volume and model identifiers for billing purposes; prompt content is not stored in usage logs.

**Providers:** Anthropic (language model features); Voyage AI (semantic search embeddings).

We do not use your private workspace data to train public foundation models. You should not submit special category data unless you have a lawful basis and appropriate safeguards. AI outputs are assistive and may be inaccurate — you remain responsible for decisions made in your business.

## Transactional email

**Data:** sender/recipient addresses, subject, message body, and delivery log metadata.

**Purpose:** product and transactional emails (invites, invoices, booking confirmations, etc.).

**Sub-processors:** ZeptoMail (EU data centre).

**Retention:** delivery logs are retained for 12 months, then deleted.

## Video hosting

**Data:** title, description, filename, hosting identifiers, and media files.

**Purpose:** host and play videos you upload.

**Sub-processors:** Supabase (metadata); Bunny.net (video storage and streaming, EU storage region).

**Retention:** videos and metadata are deleted within 30 days of account closure, or when you delete them.

## MCP API

If you connect an external AI client via our MCP API, that client can access tasks, projects, deals, clients, and notes within your own workspace permissions. Email message bodies are not exposed via this path. You are responsible for the external MCP client you choose to connect.

## Sub-processors

We use the following sub-processors to operate Ozer. A matching register is published on our [Trust Centre](/trust#sub-processors). We do not list integrations that are not yet shipped.

| Name | Purpose | Data (high level) | Location & transfer mechanism |
| --- | --- | --- | --- |
| Supabase / AWS | Database, auth, storage | Workspace and account data | EU West (Ireland) — no restricted transfer |
| Stripe | SaaS billing and Connect payments | Customer IDs, subscription status; card numbers stay with Stripe | US — Stripe Data Transfers Addendum (UK IDTA incorporated; EU-US Data Privacy Framework incl. UK Extension) |
| Anthropic | AI language model features | Workspace / email / transcript text prompts | US — DPA with EU SCCs and UK Addendum (incorporated in commercial terms); EU-US Data Privacy Framework |
| Google | Gmail, Calendar, Workspace directory | Mailbox, calendar, and directory data | US/global — Google Data Processing Terms (SCCs and UK Addendum incorporated) |
| Microsoft | Signatures directory sync | Staff profile and photo data | US/global — Microsoft Products and Services Data Protection Addendum (SCCs and UK Addendum incorporated) |
| ZeptoMail (Zoho) | Transactional email | Recipient, subject, message body | EU data centre — Zoho DPA with standard contractual clauses |
| Bunny.net (BunnyWay d.o.o.) | Video hosting and streaming | Media files and video metadata | Slovenia (EU) — EU-headquartered; DPA in place; EU storage region |
| Voyage AI | Semantic search embeddings | Text excerpts and search queries | US — Voyage AI DPA with EU SCCs and UK ICO Addendum (incorporated in commercial terms) |

## International transfers

Primary customer data storage is in AWS EU West (Ireland). Where a sub-processor processes personal data outside the UK/EEA, we rely on the transfer mechanisms listed in the sub-processor table above — UK International Data Transfer Addendum and/or EU Standard Contractual Clauses incorporated into each provider's data processing terms, and, where applicable, the EU-US Data Privacy Framework and its UK Extension.

## Retention & rights

Feature-specific retention periods are stated in the sections above. On account termination we delete customer data across our systems within 30 days, except records we must keep for legal reasons (for example, billing records retained for 6 years for tax purposes).

You may access, rectify, erase, restrict, object, or port your data, and lodge a complaint with the ICO (UK) or your local supervisory authority. Contact: privacy@ozer.so.

Business customers processing personal data through Ozer should also review our [Data Processing Agreement](/dpa).
