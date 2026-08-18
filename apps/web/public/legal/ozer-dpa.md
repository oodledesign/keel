# Data Processing Agreement

UK GDPR Article 28 terms for customers who use Ozer as a processor.

**Under active legal review.** This Data Processing Agreement reflects Ozer's current Article 28 terms and is in effect for customers relying on it today. Counsel review of the full agreement remains in progress.

**Version:** 17 August 2026. Operated by Oodle Designs Ltd ("Processor" / "Ozer"). This DPA is incorporated by reference into the Terms of Service for business accounts. A countersigned copy is available on request via privacy@ozer.so.

## 1. Roles and subject matter

This DPA applies where the customer ("Controller") uses Ozer to process personal data and Ozer acts as processor. Ozer remains controller for account/auth data, product analytics and security logs, and SaaS billing customer records. Dual-role processing is described in Annex A.

## 2. Duration

This DPA applies for the term of the Controller's agreement with Ozer and until deletion or return of personal data as set out below.

## 3. Nature and purpose of processing

Processing is for providing the Ozer workspace and related features (CRM, invoicing, email assist, calendar, bookings, transcripts, activity tracking, signatures, AI features, transactional email, video, MCP access) as enabled by the Controller, and for Ozer's own product analytics and security logging as controller. Categories are in Annex A.

## 4. Types of personal data and data subjects

See Annex A.

**Data subjects:** the Controller's staff and team members, clients and contacts, booking invitees, meeting attendees, and email correspondents.

## 5. Obligations of the Processor

Ozer shall:

- process personal data only on documented instructions from the Controller, including with regard to transfers, unless required by UK/EU law;
- ensure persons authorised to process personal data are bound by confidentiality;
- implement appropriate technical and organisational measures (see Section 8 and the Trust Centre);
- respect the conditions for engaging sub-processors (Section 6 and Annex B);
- taking into account the nature of processing, assist the Controller with data subject rights requests;
- assist the Controller with security, breach notification, and DPIA / prior consultation obligations, taking into account the nature of processing and information available to Ozer;
- at the choice of the Controller, delete or return personal data after the end of processing services, and delete existing copies unless UK/EU law requires storage. **Deletion is completed within 30 days of termination**, except records subject to statutory retention (billing/tax records: 6 years);
- make available information necessary to demonstrate compliance and allow audits as set out in Section 10.

## 6. Sub-processors

The Controller authorises Ozer to engage the sub-processors listed in Annex B. Ozer will give the Controller **at least 30 days' notice** of intended additions or replacements of sub-processors, via the Trust Centre sub-processor register and email to workspace owners, and give the Controller an opportunity to object on reasonable grounds. If an objection cannot be resolved in good faith, the Controller may terminate the affected services.

## 7. International transfers

Primary customer data storage is in AWS EU West (Ireland). Where sub-processors process personal data outside the UK/EEA, transfers rely on the following mechanisms, as recorded per sub-processor in Annex B:

- the UK International Data Transfer Addendum to the EU Standard Contractual Clauses, and/or
- the EU Standard Contractual Clauses (2021), as incorporated into the relevant sub-processor's data processing terms, and/or
- the EU-US Data Privacy Framework (including the UK Extension) where the sub-processor is certified.

Ozer maintains records of the applicable mechanism for each sub-processor and will make them available to the Controller on request.

## 8. Security

Measures include encryption in transit, encryption at rest, workspace-level access isolation, role-based access controls, and application-layer AES-256-GCM encryption of Google OAuth tokens (for example Gmail and Google Calendar), with other stored integration credentials (including Microsoft 365 Signatures tokens) protected by database encryption at rest. Sensitive optional features (activity tracking, meeting recording) are disabled by default and require explicit enablement. Further detail is published on the Trust Centre.

## 9. Personal data breaches

Ozer will notify the Controller without undue delay, and in any event **within 72 hours**, after becoming aware of a personal data breach affecting Controller personal data. Notification will describe the nature of the breach, likely consequences, and measures taken or proposed, so far as known at the time, with updates as information develops.

## 10. Audit rights

On at least **30 days' written notice** and **no more than once in any 12-month period**, the Controller may audit Ozer's compliance with this DPA. Audits are satisfied in the first instance by Ozer providing its security documentation, certifications, and completed security questionnaires. On-site or remote inspections beyond documentation are at the Controller's cost, must not unreasonably disrupt Ozer's operations, and are subject to confidentiality undertakings.

## 11. Liability

Each party's liability under this DPA is subject to the limitation of liability clause in the Terms of Service. Nothing in this DPA limits either party's liability for breaches of confidentiality or data protection obligations to the extent such limitation is not permitted by applicable law.

## 12. Governing law

This DPA is governed by the laws of England and Wales, unless mandatory data protection law requires otherwise.

## 13. Order of precedence

On data protection processing matters, this DPA prevails over the Terms of Service. The Privacy Policy describes Ozer's practices but does not reduce Article 28 obligations.

## Annex A — Categories of personal data

- Account users: name, email, auth identifiers, workspace membership.
- CRM: clients and contacts (name, email, phone, address, picture); tasks/notes/projects links.
- Invoicing / proposals / contracts: recipient emails, templates, document metadata, portal tokens.
- Email Assistant: OAuth tokens; email threads/messages; drafts; action items.
- Calendar: events and attendees via connected calendars.
- Bookings: invitee name, email, timezone, notes, guests, form answers, management tokens.
- Meeting transcripts: content, speaker segments/mappings, attendee emails, summaries, action items.
- Activity tracking: app name, website domain, optional URL, window title, durations (no keystrokes, audio, or screen capture).
- Signatures: staff name, email, job title, department, phones, photos, signature HTML, Microsoft/Google tokens (staff data synced from directory or entered manually).
- Billing: billing customer and subscription status (no card numbers); Connect identifiers and bank instruction fields.
- AI features: workspace text prompts for feature outputs; usage logs of volume/model only.
- Transactional email: sender/recipient, subject, body, and delivery log metadata.
- Video: title, description, filename, hosting identifiers and media files.
- MCP: tasks, projects, deals, clients, notes (workspace-permission scoped; not email bodies).
- Product analytics (Ozer as controller): usage events, device/browser metadata, user/account identifiers; session replay of product UI with input masking (30-day recording retention; may incidentally include on-screen Controller data).

## Annex B — Sub-processor schedule

The authoritative register, kept current, is published on the Trust Centre. As at the date of this DPA:

| Sub-processor | Service | Data categories | Location | Transfer mechanism |
| --- | --- | --- | --- | --- |
| Supabase / AWS | Database, auth, storage | Workspace and account data | EU West (Ireland) | Not a restricted transfer |
| Stripe | Billing and Connect payments | Billing identifiers, subscription status | US | Stripe Data Transfers Addendum (UK IDTA; EU-US DPF incl. UK Extension) |
| Anthropic | AI language model features | Workspace/email/transcript text prompts | US | DPA with EU SCCs and UK Addendum; EU-US DPF |
| Google (Gemini Flash / Flash-Lite) | High-volume AI (email triage/extract and other Flash-Lite routes) | Workspace/email text prompts | US/global | Paid Gemini API under Google Data Processing Addendum (EU SCCs and UK Addendum); EU-US DPF (Google LLC). Free AI Studio tier is not used for customer personal data. |
| Google Workspace APIs | Gmail, Calendar, Workspace directory | Mailbox, calendar, directory data | US/global | Google Data Processing Terms (SCCs and UK Addendum) |
| Microsoft | Signatures directory sync | Staff profile and photo data | US/global | Microsoft Products and Services DPA (SCCs and UK Addendum) |
| ZeptoMail (Zoho) | Transactional email | Recipient, subject, body | EU data centre | Zoho DPA with standard contractual clauses |
| Bunny.net (BunnyWay d.o.o.) | Video hosting | Media files, video metadata | Slovenia (EU) | Not a restricted transfer; DPA in place |
| Mapbox | Commercial listing maps and address geocoding | Addresses and map coordinates | US/global | Mapbox Data Processing Agreement (SCCs / UK Addendum as applicable) |
| Voyage AI | Semantic search embeddings | Text excerpts, search queries | US | Voyage AI DPA with EU SCCs and UK ICO Addendum |
| PostHog, Inc. | Product analytics, feature flags, error/session diagnostics, session replay | Usage events, device/browser data, user/account identifiers; UI session recordings (inputs masked; 30-day retention) | EU (PostHog EU Cloud) | Not a restricted transfer for EU Cloud hosting; PostHog DPA applies |

Changes to this schedule follow the notice and objection process in Section 6, via update to the Trust Centre sub-processor register and, for material changes, by email to the Controller's account contact.

---

## Execution

This DPA is incorporated by reference into the Terms of Service and takes effect when the Controller accepts those Terms with a business account. Where a countersigned copy is requested:

**For the Controller:**

Name: ____________________________

Title: ____________________________

Company: ____________________________

Date: ____________________________

Signature: ____________________________

**For Oodle Designs Ltd (Processor):**

Name: ____________________________

Title: ____________________________

Date: ____________________________

Signature: ____________________________
