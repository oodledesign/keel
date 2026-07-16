# Ozer — Data Processing Agreement (UK GDPR Article 28)

**SOLICITOR REVIEW REQUIRED.** This document is a draft. Placeholders marked `[LEGAL REVIEW NEEDED]` are intentional — do not rely on this DPA for regulatory compliance until counsel has confirmed transfer tools, retention, breach SLA, deletion timeframes, and liability.

| Field | Value |
|-------|-------|
| **Version** | 16 July 2026 |
| **Processor** | Oodle Designs Ltd (“Ozer”, “we”, “us”) |
| **Controller** | The customer entity that uses Ozer to process personal data |
| **HTML** | https://ozer.so/dpa |
| **This file** | `/legal/ozer-dpa.md` |
| **Related** | Privacy Policy, Terms of Service, Trust Centre |

---

## 1. Roles and subject matter

1.1 This Data Processing Agreement (“DPA”) applies where the Controller uses Ozer and Ozer processes personal data on the Controller’s behalf as a **processor** under UK GDPR Article 28 (and EU GDPR Article 28 where applicable).

1.2 **Dual role.** Ozer is:
- **Controller** for: account and authentication data; product analytics and security logs; SaaS billing customer records.
- **Processor** (typically) for: customer workspace CRM; email content; signatures applied to customer staff mailboxes; booking invitee data collected for the customer’s scheduling; and other Customer Content described in Annex A.

1.3 This DPA does not reduce Ozer’s controller obligations for data for which Ozer is controller.

---

## 2. Duration

2.1 This DPA applies for the term of the Controller’s agreement with Ozer (including the Terms of Service) and until personal data processed under this DPA is deleted or returned in accordance with Section 5.

---

## 3. Nature and purpose of processing

3.1 **Nature:** collection, storage, organisation, retrieval, transmission, erasure, and related automated processing via the Ozer SaaS and connected integrations enabled by the Controller.

3.2 **Purpose:** providing the Ozer service features the Controller enables, including without limitation: CRM/workspace; invoicing, proposals and contracts; Gmail Email Assistant; Google Calendar; public scheduler/bookings; meeting transcripts; activity tracking; Ozer Signatures; AI features; transactional email; video hosting; and MCP API access.

3.3 Processing is limited to what is necessary to provide those features and to comply with UK/EU law.

---

## 4. Types of personal data and data subjects

4.1 Categories of personal data and data subjects are set out exhaustively in **Annex A**.

4.2 The Controller shall not instruct Ozer to process special category data unless the Controller has a lawful basis and has documented appropriate safeguards. Ozer does not solicit special category data.

---

## 5. Obligations of the Processor (Article 28)

Ozer shall:

5.1 process personal data only on documented instructions from the Controller, including with regard to transfers of personal data to a third country or international organisation, unless required to do so by UK or EU law to which Ozer is subject; in such a case, Ozer shall inform the Controller of that legal requirement before processing, unless that law prohibits such information on important grounds of public interest;

5.2 ensure that persons authorised to process the personal data have committed themselves to confidentiality or are under an appropriate statutory obligation of confidentiality;

5.3 take all measures required pursuant to UK GDPR Article 32 (security of processing), as described in the Trust Centre and Section 8;

5.4 respect the conditions for engaging another processor as set out in Section 6 and Annex B;

5.5 taking into account the nature of the processing, assist the Controller by appropriate technical and organisational measures, insofar as possible, for the fulfilment of the Controller’s obligation to respond to requests for exercising the data subject’s rights;

5.6 assist the Controller in ensuring compliance with obligations pursuant to UK GDPR Articles 32 to 36 (security, breach notification, DPIA, prior consultation), taking into account the nature of processing and the information available to Ozer;

5.7 at the choice of the Controller, delete or return all the personal data to the Controller after the end of the provision of services relating to processing, and delete existing copies unless UK or EU law requires storage of the personal data —

   **Post-termination deletion / return timeframe: [LEGAL REVIEW NEEDED — TBD days].**  
   Systems in scope include Supabase (database and storage), Bunny.net (video binaries where used), and related application data. Stripe billing/Connect records may be retained as required for tax and payment disputes;

5.8 make available to the Controller all information necessary to demonstrate compliance with the obligations laid down in Article 28 and allow for and contribute to audits, including inspections, conducted by the Controller or another auditor mandated by the Controller —

   **Audit terms: [LEGAL REVIEW NEEDED — frequency, notice period, remote vs on-site, cost allocation].**

---

## 6. Sub-processors

6.1 The Controller provides a general authorisation for Ozer to engage the sub-processors listed in **Annex B**.

6.2 Ozer shall inform the Controller of any intended changes concerning the addition or replacement of sub-processors, thereby giving the Controller the opportunity to object to such changes on reasonable data-protection grounds.

6.3 **Change notification mechanism: [LEGAL REVIEW NEEDED — TBD notice period (e.g. 14 or 30 days); Trust Centre update and/or email to account owners].**

6.4 Where Ozer engages a sub-processor, Ozer shall impose data protection obligations equivalent to those in this DPA, so far as applicable to that sub-processor’s services. Ozer remains liable to the Controller for the sub-processor’s performance of those obligations as required by Article 28(4).

---

## 7. International transfers

7.1 Primary database storage for Ozer is in AWS EU West (Ireland), as stated on the Trust Centre.

7.2 Where personal data is transferred to or accessed from outside the UK/EEA by Ozer or a sub-processor:

   **Transfer mechanism: [LEGAL REVIEW NEEDED — TBD].**  
   Do **not** assert that Standard Contractual Clauses (SCCs), the UK International Data Transfer Agreement (IDTA), or UK Addendum are executed until solicitor confirmation. Adequacy decisions and vendor DPAs should be reviewed per sub-processor.

7.3 Sub-processors with cross-border processing that particularly require transfer review include (non-exhaustively): Anthropic, Google, Microsoft, Soniox, Voyage AI, Bunny.net, and Stripe (as applicable).

---

## 8. Security of processing

8.1 Taking into account the state of the art, costs, and the nature, scope, context and purposes of processing, Ozer implements appropriate technical and organisational measures, including as described in the Trust Centre:

- encryption in transit (HTTPS / TLS 1.2 or above);
- encryption at rest (AES-256 via Supabase/AWS);
- Row-Level Security (RLS) on customer data tables;
- restricted production access with strong authentication;
- AES-256-GCM encryption for Google OAuth tokens where that encryption path is implemented.

8.2 The Controller is responsible for configuring product features (including recording, activity tracking, and third-party OAuth connections) in a manner consistent with the Controller’s own security and privacy obligations.

---

## 9. Personal data breaches

9.1 Ozer shall notify the Controller without undue delay after becoming aware of a personal data breach affecting personal data processed under this DPA.

9.2 **Target notification SLA to Controller: [LEGAL REVIEW NEEDED — TBD hours].**

9.3 Notification will include, to the extent known: nature of the breach; categories and approximate number of data subjects and records; likely consequences; and measures taken or proposed. Ozer’s notification does not constitute an admission of fault or liability.

9.4 The Controller remains responsible for notifying the ICO or data subjects where required of the Controller.

---

## 10. Liability

10.1 **[LEGAL REVIEW NEEDED — TBD: liability caps, carve-outs, indemnities, and interaction with the limitation of liability in the Terms of Service.]**

10.2 Nothing in this DPA excludes liability that cannot be excluded under applicable law.

---

## 11. Governing law and jurisdiction

11.1 This DPA is governed by the laws of England and Wales, unless mandatory data protection law requires otherwise.

11.2 The courts of England and Wales have exclusive jurisdiction over disputes arising from this DPA, without prejudice to mandatory rights.

---

## 12. Order of precedence and updates

12.1 On matters relating to the processing of personal data under Article 28, this DPA prevails over the Terms of Service and Privacy Policy.

12.2 Ozer may update this DPA to reflect product or legal changes. Material changes affecting processing will be notified via the mechanisms used for Terms updates and/or the Trust Centre. Continued use after the effective date constitutes acceptance, except where a signed customer DPA provides otherwise [LEGAL REVIEW NEEDED — signed DPA workflow].

---

## Annex A — Personal data categories (exhaustive inventory)

| Feature / area | Personal data / categories | Data subjects (typical) |
|----------------|----------------------------|-------------------------|
| Account (Ozer as controller) | Name, email, password hash / auth IDs, workspace membership | Ozer users |
| Core workspace CRM | Clients: name, email, phone, address, picture; contacts / client_contacts; links to tasks, notes, projects | Controller’s clients and contacts |
| Invoicing / proposals / contracts | Invoice and document content; recipient emails; email templates; PDF metadata; portal tokens | Clients, recipients, Controller users |
| Gmail Email Assistant | OAuth tokens (encrypted); email_threads / email_messages including body_text and body_html; drafts; action items | Mailbox users; email correspondents |
| Google Calendar | Calendar events and attendees via OAuth | Meeting participants; Controller users |
| Public scheduler | invitee_name, email, timezone, notes; guests; form answers (incl. phone); management_token | Invitees / guests |
| Meeting transcripts | content; speaker segments/mappings; attendee emails; summaries; action items | Meeting attendees |
| Activity tracking | app_name, bundle_id, domain, optional url, window_title, durations (no keystrokes/audio/screens); opt-in, defaults off | Device users |
| Ozer Signatures | Staff name, email, job title, dept, phones, photos; signature HTML; MS/Google tokens | Controller’s staff |
| Platform billing (Ozer as controller) | billing_customers, subscription status (no PAN) | Paying customers |
| Client payments (Connect) | Connect account IDs, customer IDs, bank instruction fields | Controller’s payees / clients |
| AI (non-email) | Workspace text prompts for feature outputs; ai_credit_transactions: tokens/model only | As contained in Customer Content |
| Transactional email | to/from/subject/html; platform_email_log metadata | Recipients |
| Video hosting | title, description, filename, Bunny IDs; media binaries | As depicted / identified in media |
| MCP API | Tasks, projects, deals, clients, notes (RLS-scoped); **not** email bodies | As in workspace records |

**Speech-to-text note:** Mac Assistant path uses on-device WhisperKit + SpeakerKit; web/session path may use Soniox cloud STT (`stt-rt-v5`). Transcript **text** is stored in Supabase in both cases.

**Excluded until shipped:** Composio.

---

## Annex B — Sub-processor schedule

| Name | Purpose | Data categories (high level) | Location note |
|------|---------|------------------------------|---------------|
| Supabase / AWS | Primary database, auth, storage | All workspace & account data in scope | EU West (Ireland) per Trust Centre |
| Stripe | SaaS billing + Connect payments | Customer IDs, subscription status; PAN stays with Stripe | [LEGAL REVIEW NEEDED] |
| Anthropic | LLM features | Workspace/email/transcript text prompts | [LEGAL REVIEW NEEDED] |
| Google (Gmail, Calendar, Workspace; Gemini if enabled) | Email/calendar/signatures; AI if wired | Mailbox/calendar/directory; AI prompts if wired | [LEGAL REVIEW NEEDED] |
| Microsoft Graph | Signatures directory + mailbox settings | Staff profile, photo, mailbox settings | [LEGAL REVIEW NEEDED] |
| ZeptoMail | Transactional email | Recipient, subject, HTML body | EU API endpoint used in product |
| Bunny.net Stream | Video hosting | Media files + video metadata | [LEGAL REVIEW NEEDED] |
| Voyage AI | Embeddings (Second Brain) when keyed | Chunk/query text | [LEGAL REVIEW NEEDED] |
| Soniox | Cloud realtime STT (web recorder path) | Audio stream / transcript | [LEGAL REVIEW NEEDED] |

**Change notification:** [LEGAL REVIEW NEEDED — TBD mechanism and notice period].

**Authorised Microsoft Graph scopes (Signatures):** `MailboxSettings.ReadWrite`, `User.Read.All`, `ProfilePhoto.Read.All`, `offline_access` (delegated); app token `.default` where configured.

**Authorised Google scopes (examples):** Gmail Assistant — `gmail.readonly`, `gmail.modify`, `gmail.settings.basic`; Calendar — `calendar.readonly`, `calendar.events`; Signatures — `admin.directory.user.readonly`, `gmail.settings.basic`.

---

*End of DPA draft — 16 July 2026.*
