import Link from 'next/link';

const legalProseClass =
  'prose prose-neutral dark:prose-invert max-w-3xl space-y-6 text-sm leading-relaxed';

const tableClass =
  'w-full border-collapse text-left text-xs [&_th]:border [&_th]:border-border [&_th]:bg-muted/40 [&_th]:px-2 [&_th]:py-1.5 [&_th]:font-medium [&_td]:border [&_td]:border-border [&_td]:px-2 [&_td]:py-1.5';

function LegalLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="text-primary font-medium underline-offset-4 hover:underline"
    >
      {children}
    </Link>
  );
}

export function PrivacyPolicyContent() {
  return (
    <article className={legalProseClass}>
      <p>
        <strong>Last updated:</strong> 16 July 2026. Oodle Designs Ltd
        (&quot;Ozer&quot;, &quot;we&quot;, &quot;us&quot;) is the data
        controller for personal data we process for our own purposes (account
        and authentication data, product analytics and security logs, and SaaS
        billing records). Where you use Ozer to store or process your
        clients&apos;, staff, or invitees&apos; personal data, we typically act
        as a <strong>processor</strong> on your instructions. See our{' '}
        <LegalLink href="/dpa">Data Processing Agreement</LegalLink> for that
        relationship. We comply with the UK GDPR, EU GDPR, and the Data
        Protection Act 2018.
      </p>

      <section>
        <h2>What we collect</h2>
        <ul>
          <li>
            Account details: name, email, password hash, workspace membership.
          </li>
          <li>
            Workspace content you create: tasks, notes, clients, contacts,
            invoices, files, and related CRM records.
          </li>
          <li>
            Billing data processed by Stripe (we do not store full card
            numbers).
          </li>
          <li>
            Usage, device, and security logs; optional analytics cookies with
            consent.
          </li>
          <li>
            AI feature inputs and outputs where you use Ozer AI (Second Brain,
            email assist, task extract, etc.).
          </li>
          <li>
            Optional integrations and Mac Assistant data described in the feature
            sections below (email, calendar, transcription, activity tracking,
            signatures, bookings, video).
          </li>
        </ul>
      </section>

      <section>
        <h2>Lawful bases</h2>
        <p>
          We process data to perform our contract with you, for legitimate
          interests (security, product improvement), with consent where required
          (marketing/analytics cookies; meeting recording and activity tracking
          as described below), and to meet legal obligations (tax, fraud
          prevention). Where we act as your processor, you are responsible for
          ensuring you have a lawful basis for the personal data you instruct us
          to process.
        </p>
      </section>

      <section>
        <h2>Core workspace CRM</h2>
        <p>
          <strong>Data:</strong> client and contact records (name, email, phone,
          address, picture), and links to tasks, notes, and projects.
        </p>
        <p>
          <strong>Purpose:</strong> to run your CRM and workspace so you can
          manage client relationships.
        </p>
        <p>
          <strong>UK GDPR basis (our controller processing):</strong> contract
          performance for account services; where we process as your processor,
          your instructions apply.
        </p>
        <p>
          <strong>Sub-processors:</strong> Supabase (primary database).
        </p>
        <p>
          <strong>Retention:</strong> [LEGAL REVIEW NEEDED — TBD: while the
          account is active and thereafter per your deletion instructions /
          legal retention].
        </p>
        <p>
          <strong>International transfers:</strong> primary storage in EU West
          (Ireland) per our Trust Centre. Additional transfer mechanisms for
          other vendors: [LEGAL REVIEW NEEDED — TBD].
        </p>
      </section>

      <section>
        <h2>Invoicing, proposals, and contracts</h2>
        <p>
          <strong>Data:</strong> invoice and document content, recipient emails,
          email templates, PDF metadata, and portal access tokens.
        </p>
        <p>
          <strong>Purpose:</strong> to bill and contract with your clients, send
          documents, and enable payment where configured.
        </p>
        <p>
          <strong>UK GDPR basis:</strong> contract performance / your
          instructions as controller of client data.
        </p>
        <p>
          <strong>Sub-processors:</strong> Supabase; ZeptoMail (send);
          Stripe Connect (client payments when enabled).
        </p>
        <p>
          <strong>Retention:</strong> [LEGAL REVIEW NEEDED — TBD, including tax
          retention for billing records].
        </p>
        <p>
          <strong>International transfers:</strong> [LEGAL REVIEW NEEDED —
          TBD for Stripe/ZeptoMail processing locations].
        </p>
      </section>

      <section>
        <h2>Gmail Email Assistant</h2>
        <p>
          <strong>Data:</strong> OAuth tokens (encrypted at rest with
          AES-256-GCM), email threads and messages including body text and HTML,
          drafts, and extracted action items.
        </p>
        <p>
          <strong>Purpose:</strong> to sync your connected mailbox, triage
          messages, extract tasks, and draft replies when you use those
          features.
        </p>
        <p>
          <strong>Google scopes:</strong>{' '}
          <code>gmail.readonly</code>, <code>gmail.modify</code>,{' '}
          <code>gmail.settings.basic</code>.
        </p>
        <p>
          <strong>UK GDPR basis:</strong> contract performance and your
          instructions; you must ensure staff/customer email content is processed
          lawfully.
        </p>
        <p>
          <strong>Sub-processors:</strong> Google (Gmail API); Anthropic (Sonnet)
          for classify / extract / draft on thread text (not HTML).
        </p>
        <p>
          <strong>Retention:</strong> [LEGAL REVIEW NEEDED — TBD for synced mail
          and drafts after disconnect].
        </p>
        <p>
          <strong>International transfers:</strong> [LEGAL REVIEW NEEDED —
          TBD — pending legal review for Anthropic/Google cross-border
          processing; do not assume SCCs/UK IDTA without confirmation].
        </p>
      </section>

      <section>
        <h2>Google Calendar</h2>
        <p>
          <strong>Data:</strong> calendar connection records and calendar
          events/attendees accessed via OAuth.
        </p>
        <p>
          <strong>Purpose:</strong> planner and meeting context, including
          writing events when you use scheduling features with a connected
          calendar.
        </p>
        <p>
          <strong>Google scopes:</strong> <code>calendar.readonly</code>,{' '}
          <code>calendar.events</code>.
        </p>
        <p>
          <strong>UK GDPR basis:</strong> contract performance / your
          instructions.
        </p>
        <p>
          <strong>Sub-processors:</strong> Google Calendar API; Supabase.
        </p>
        <p>
          <strong>Retention:</strong> [LEGAL REVIEW NEEDED — TBD].
        </p>
        <p>
          <strong>International transfers:</strong> [LEGAL REVIEW NEEDED —
          TBD for Google].
        </p>
      </section>

      <section>
        <h2>Public scheduler and bookings</h2>
        <p>
          <strong>Data:</strong> invitee name, email, timezone, notes, guests,
          form answers (which may include phone numbers), and booking management
          tokens.
        </p>
        <p>
          <strong>Purpose:</strong> to run your public booking links and allow
          invitees to manage bookings.
        </p>
        <p>
          <strong>UK GDPR basis:</strong> you are typically the controller of
          invitee data; we process it on your instructions. Our own processing of
          transactional emails is for contract performance.
        </p>
        <p>
          <strong>Sub-processors:</strong> Supabase; ZeptoMail; Google Calendar
          (when connected and writing events).
        </p>
        <p>
          <strong>Retention:</strong> [LEGAL REVIEW NEEDED — TBD].
        </p>
        <p>
          <strong>International transfers:</strong> [LEGAL REVIEW NEEDED —
          TBD].
        </p>
      </section>

      <section>
        <h2>Meeting transcripts and recording</h2>
        <p>
          <strong>Data:</strong> transcript text, speaker segments and mappings,
          attendee emails, summaries, and action items. Audio is processed for
          speech-to-text; permanent meeting audio retention is not the product
          model described on our Trust Centre for the Mac Assistant path.
        </p>
        <p>
          <strong>Purpose:</strong> meeting memory, summaries, and follow-up
          tasks.
        </p>
        <p>
          <strong>Consent:</strong> meeting recording and transcription require
          explicit product consent / enablement. You remain responsible for
          informing meeting attendees as required by law — our in-product
          consent does not replace your attendee notice duties.
        </p>
        <p>
          <strong>Speech-to-text paths:</strong>
        </p>
        <ul>
          <li>
            <strong>OzerAssistant for Mac:</strong> WhisperKit on-device
            transcription and SpeakerKit diarisation locally; transcript text is
            still uploaded to Ozer.
          </li>
          <li>
            <strong>Keel web / session API path:</strong> Soniox cloud realtime
            STT (<code>stt-rt-v5</code>) when using in-browser/session
            transcription.
          </li>
        </ul>
        <p>
          <strong>UK GDPR basis:</strong> consent and/or your instructions as
          controller of attendee data.
        </p>
        <p>
          <strong>Sub-processors:</strong> Supabase; Soniox (cloud STT path);
          Anthropic (summaries / extraction where enabled).
        </p>
        <p>
          <strong>Retention:</strong> [LEGAL REVIEW NEEDED — TBD for transcript
          text].
        </p>
        <p>
          <strong>International transfers:</strong> [LEGAL REVIEW NEEDED —
          TBD for Soniox/Anthropic].
        </p>
      </section>

      <section>
        <h2>Activity tracking (Mac Assistant)</h2>
        <p>
          <strong>Data:</strong> activity blocks including app name, bundle ID,
          domain, optional URL, window title, and durations. We do{' '}
          <strong>not</strong> capture keystrokes, audio, or screen recordings
          for this feature.
        </p>
        <p>
          <strong>Purpose:</strong> day reconstruction and time attribution when
          you opt in.
        </p>
        <p>
          <strong>Consent / opt-in:</strong> activity tracking is off by default
          (<code>tracking_enabled</code> defaults to false). Full URL capture is
          also off by default. You must explicitly enable tracking.
        </p>
        <p>
          <strong>UK GDPR basis:</strong> consent / explicit opt-in.
        </p>
        <p>
          <strong>Sub-processors:</strong> Supabase (Ozer backend only for this
          feature).
        </p>
        <p>
          <strong>Retention:</strong> [LEGAL REVIEW NEEDED — TBD].
        </p>
        <p>
          <strong>International transfers:</strong> stored with primary EU West
          database; [LEGAL REVIEW NEEDED — TBD for any further transfers].
        </p>
      </section>

      <section>
        <h2>Ozer Signatures</h2>
        <p>
          <strong>Data:</strong> staff name, email, job title, department,
          phones, photos, signature HTML, and Microsoft/Google connection
          tokens.
        </p>
        <p>
          <strong>Purpose:</strong> to build and deploy email signatures for
          your organisation&apos;s staff mailboxes. Processing is limited to
          signature deployment and related directory/profile sync — not general
          mailbox reading.
        </p>
        <p>
          <strong>UK GDPR basis:</strong> you are typically the controller of
          staff data; we process on your instructions. Contract performance for
          providing the Signatures product.
        </p>
        <p>
          <strong>Sub-processors:</strong> Supabase (including{' '}
          <code>signatures-photos</code> storage); Microsoft Graph; Google
          Workspace / Gmail APIs.
        </p>
        <p>
          <strong>Retention:</strong> [LEGAL REVIEW NEEDED — TBD after
          disconnect or staff removal].
        </p>
        <p>
          <strong>International transfers:</strong> [LEGAL REVIEW NEEDED —
          TBD for Microsoft/Google].
        </p>

        <h3>Microsoft Entra / Graph permissions (administrators)</h3>
        <p>
          When an Entra administrator connects Microsoft for Signatures, Ozer
          requests these delegated permissions in plain English:
        </p>
        <ul>
          <li>
            <code>MailboxSettings.ReadWrite</code> — read and update mailbox
            settings needed to apply signature HTML.
          </li>
          <li>
            <code>User.Read.All</code> — read user directory profiles for staff
            listed in Signatures.
          </li>
          <li>
            <code>ProfilePhoto.Read.All</code> — read profile photos for
            signature images.
          </li>
          <li>
            <code>offline_access</code> — refresh tokens so the connection can
            continue without re-consent every session.
          </li>
        </ul>
        <p>
          App-only access uses the Microsoft Graph{' '}
          <code>.default</code> application permission set where configured.{' '}
          <strong>Status:</strong> Microsoft profile sync is live. Outlook Graph
          HTML signature push is still incomplete (placeholder) at the time of
          this update — Gmail sendAs signature push is live for Google Workspace
          connections.
        </p>

        <h3>Google Workspace permissions</h3>
        <ul>
          <li>
            <code>admin.directory.user.readonly</code> — read user directory
            data for staff sync.
          </li>
          <li>
            <code>gmail.settings.basic</code> — update Gmail sendAs signature
            settings.
          </li>
        </ul>
      </section>

      <section>
        <h2>Platform billing and client payments</h2>
        <p>
          <strong>Platform billing data:</strong> billing customer records and
          subscription status. We do not store card PAN; Stripe processes card
          payments.
        </p>
        <p>
          <strong>Client payments (Stripe Connect):</strong> Connect account
          IDs, customer IDs, and bank instruction fields on payment settings for
          invoice Pay Now / bank details.
        </p>
        <p>
          <strong>Purpose:</strong> SaaS subscription billing; collecting
          payment from your clients when you enable Connect.
        </p>
        <p>
          <strong>UK GDPR basis:</strong> contract performance; legal
          obligations for tax/accounting where applicable.
        </p>
        <p>
          <strong>Sub-processors:</strong> Stripe; Supabase.
        </p>
        <p>
          <strong>Retention:</strong> [LEGAL REVIEW NEEDED — TBD for billing
          records after cancellation].
        </p>
        <p>
          <strong>International transfers:</strong> see Stripe&apos;s
          documentation; [LEGAL REVIEW NEEDED — TBD for transfer tool wording].
        </p>
      </section>

      <section>
        <h2>AI processing (non-email)</h2>
        <p>
          When you use AI features (Site Studio, Second Brain, proposals,
          meetings, Rankly, and similar), relevant workspace text may be sent to
          our AI sub-processors to generate responses. Prompt/content is not
          stored in the AI credit log; <code>ai_credit_transactions</code>{' '}
          records tokens and model identifiers only.
        </p>
        <p>
          <strong>Providers in use:</strong> Anthropic (Haiku/Sonnet) for most
          paths; Voyage embeddings when configured for Second Brain. Google
          Gemini Flash-Lite may be configured in code for triage but is{' '}
          <strong>not wired</strong> into live triage features at the time of
          this update.
        </p>
        <p>
          We do not use your private workspace data to train public foundation
          models. You should not submit special category data unless you have a
          lawful basis and appropriate safeguards. EU AI Act transparency: AI
          outputs are assistive and may be inaccurate — you remain responsible
          for decisions made in your business.
        </p>
        <p>
          <strong>International transfers:</strong> [LEGAL REVIEW NEEDED —
          TBD — pending legal review for Anthropic/Voyage/Google where
          processing may occur outside the UK/EEA].
        </p>
      </section>

      <section>
        <h2>Transactional email</h2>
        <p>
          <strong>Data:</strong> to/from, subject, HTML body, and platform email
          log metadata.
        </p>
        <p>
          <strong>Purpose:</strong> product and transactional emails (invites,
          invoices, booking confirmations, etc.).
        </p>
        <p>
          <strong>Sub-processors:</strong> ZeptoMail (default EU API); optional
          Resend if configured.
        </p>
        <p>
          <strong>Retention:</strong> [LEGAL REVIEW NEEDED — TBD for email
          logs].
        </p>
      </section>

      <section>
        <h2>Video hosting</h2>
        <p>
          <strong>Data:</strong> title, description, filename, Bunny Stream
          identifiers, and media binaries.
        </p>
        <p>
          <strong>Purpose:</strong> host and play videos you upload.
        </p>
        <p>
          <strong>Sub-processors:</strong> Supabase (metadata); Bunny.net
          (Stream).
        </p>
        <p>
          <strong>Retention / region:</strong> [LEGAL REVIEW NEEDED — TBD for
          Bunny storage region and deletion after account closure].
        </p>
      </section>

      <section>
        <h2>MCP API</h2>
        <p>
          If you connect an external AI client via <code>/api/mcp</code>, that
          client may access tasks, projects, deals, clients, and notes scoped by
          Row-Level Security. Email message bodies are not exposed via this
          path. You are responsible for the external MCP client you choose.
        </p>
      </section>

      <section>
        <h2>Payments</h2>
        <p>
          Payments are handled by Stripe Payments Europe Ltd (or Stripe UK as
          applicable). See Stripe&apos;s privacy notice for card processing. We
          receive billing status, customer IDs, and invoice metadata.
        </p>
      </section>

      <section>
        <h2>Sub-processors</h2>
        <p>
          We use the following sub-processors to operate Ozer. A matching
          register is published on our{' '}
          <LegalLink href="/trust#sub-processors">Trust Centre</LegalLink>. We
          do not list integrations that are not yet shipped.
        </p>
        <div className="not-prose overflow-x-auto">
          <table className={tableClass}>
            <thead>
              <tr>
                <th scope="col">Name</th>
                <th scope="col">Purpose</th>
                <th scope="col">Data (high level)</th>
                <th scope="col">Location note</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Supabase / AWS</td>
                <td>Database, auth, storage</td>
                <td>Workspace and account data</td>
                <td>EU West (Ireland)</td>
              </tr>
              <tr>
                <td>Stripe</td>
                <td>SaaS billing and Connect</td>
                <td>Customer IDs, subscription status; PAN stays with Stripe</td>
                <td>[LEGAL REVIEW NEEDED]</td>
              </tr>
              <tr>
                <td>Anthropic</td>
                <td>LLM features</td>
                <td>Workspace / email / transcript text prompts</td>
                <td>[LEGAL REVIEW NEEDED]</td>
              </tr>
              <tr>
                <td>Google</td>
                <td>Gmail, Calendar, Workspace; Gemini if enabled</td>
                <td>Mailbox, calendar, directory; AI prompts if wired</td>
                <td>[LEGAL REVIEW NEEDED]</td>
              </tr>
              <tr>
                <td>Microsoft Graph</td>
                <td>Signatures directory and mailbox settings</td>
                <td>Staff profile, photo, mailbox settings</td>
                <td>[LEGAL REVIEW NEEDED]</td>
              </tr>
              <tr>
                <td>ZeptoMail</td>
                <td>Transactional email</td>
                <td>Recipient, subject, HTML body</td>
                <td>EU API endpoint used in product</td>
              </tr>
              <tr>
                <td>Bunny.net</td>
                <td>Video hosting (Stream)</td>
                <td>Media files and video metadata</td>
                <td>[LEGAL REVIEW NEEDED]</td>
              </tr>
              <tr>
                <td>Voyage AI</td>
                <td>Embeddings (Second Brain) when keyed</td>
                <td>Chunk / query text</td>
                <td>[LEGAL REVIEW NEEDED]</td>
              </tr>
              <tr>
                <td>Soniox</td>
                <td>Cloud realtime STT (web path)</td>
                <td>Audio stream / transcript</td>
                <td>[LEGAL REVIEW NEEDED]</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2>International transfers</h2>
        <p>
          Primary customer database storage is in AWS EU West (Ireland). Where
          data is processed by sub-processors outside the UK/EEA, we will rely
          on appropriate transfer mechanisms once confirmed.
        </p>
        <p>
          [LEGAL REVIEW NEEDED — TBD: do not assert that Standard Contractual
          Clauses or the UK IDTA are executed until solicitor confirmation. This
          section will be updated after legal review.]
        </p>
      </section>

      <section>
        <h2>Retention &amp; rights</h2>
        <p>
          We retain account and workspace data while your account is active and
          as required by law. Specific feature retention periods are marked TBD
          above pending a business and legal decision. On termination, deletion
          across Supabase, Bunny, and Stripe is described in our Terms;{' '}
          <strong>deletion timeframe TBD</strong> [LEGAL REVIEW NEEDED].
        </p>
        <p>
          You may access, rectify, erase, restrict, object, or port your data,
          and lodge a complaint with the ICO (UK) or your local supervisory
          authority. Contact: privacy@ozer.so.
        </p>
        <p>
          Business customers processing personal data through Ozer should also
          review our <LegalLink href="/dpa">Data Processing Agreement</LegalLink>
          .
        </p>
      </section>
    </article>
  );
}

export function TermsOfServiceContent() {
  return (
    <article className={legalProseClass}>
      <p>
        <strong>Last updated:</strong> 16 July 2026. These Terms govern use of
        Ozer operated by Oodle Designs Ltd. By creating an account and accepting
        these Terms you agree to be bound by them.
      </p>

      <section>
        <h2>Service</h2>
        <p>
          Ozer provides workspace software for personal and business
          productivity including optional paid plans and marketplace apps.
          Features may change; we will give reasonable notice of material
          changes.
        </p>
      </section>

      <section>
        <h2>Accounts &amp; acceptable use</h2>
        <p>
          You must provide accurate information, keep credentials secure, and
          use Ozer lawfully. You are responsible for content in your workspaces
          and for inviting team members in line with your plan limits.
        </p>
        <p>Without limiting the above, you must not:</p>
        <ul>
          <li>
            <strong>Workspace / CRM:</strong> store or process personal data
            unlawfully, or use the CRM to harass, defraud, or mislead clients or
            contacts.
          </li>
          <li>
            <strong>Email Assistant:</strong> connect mailboxes you are not
            authorised to access, or use draft/send features to spam or
            impersonate others.
          </li>
          <li>
            <strong>Meeting recording / transcription:</strong> record or
            transcribe meetings without informing attendees where required by
            law, or use transcripts to violate privacy or confidentiality
            duties.
          </li>
          <li>
            <strong>Activity tracking:</strong> enable tracking on devices you
            do not control or without required notices to affected individuals
            (for example employees).
          </li>
          <li>
            <strong>Signatures:</strong> connect Microsoft or Google tenant
            credentials without authority, or use Signatures to push content
            unrelated to legitimate email signature deployment.
          </li>
          <li>
            <strong>Invoicing / Stripe Connect:</strong> misuse payment features
            for fraud, chargeback abuse, or prohibited businesses under
            Stripe&apos;s terms.
          </li>
          <li>
            <strong>Public booking links:</strong> collect invitee data without
            a lawful basis, or use booking forms for phishing or unlawful
            surveillance.
          </li>
        </ul>
      </section>

      <section>
        <h2>Customer responsibilities as controller</h2>
        <p>
          Where you instruct Ozer to process personal data of your staff,
          clients, contacts, or booking invitees, you are typically the{' '}
          <strong>controller</strong> and Ozer is your <strong>processor</strong>
          . You are responsible for:
        </p>
        <ul>
          <li>
            Having a lawful basis and providing required privacy notices
            (including for Signatures staff data, Gmail content, and public
            booking invitees).
          </li>
          <li>
            Configuring integrations and permissions only for authorised
            accounts and tenants.
          </li>
          <li>
            Responding to data subject requests that relate to personal data you
            control, with our assistance as set out in the DPA.
          </li>
        </ul>
      </section>

      <section>
        <h2>Meeting recording and attendee notice</h2>
        <p>
          If you use meeting recording or transcription, you must inform
          attendees as required by applicable law and your own policies.
          Consent or enablement inside the Ozer product does{' '}
          <strong>not</strong> replace your duty to notify attendees.
        </p>
      </section>

      <section>
        <h2>Data Processing Agreement</h2>
        <p>
          Our standalone Data Processing Agreement forms part of these Terms for
          customers who process personal data through Ozer as controllers. The
          DPA is available at <LegalLink href="/dpa">/dpa</LegalLink> and as a
          downloadable markdown file at{' '}
          <LegalLink href="/legal/ozer-dpa.md">/legal/ozer-dpa.md</LegalLink>.
          In the event of conflict on data protection processing terms, the DPA
          prevails for those matters.
        </p>
      </section>

      <section>
        <h2>Subscriptions &amp; payments</h2>
        <p>
          Paid plans renew automatically via Stripe until cancelled. Prices
          include VAT where applicable. Refunds follow our billing policy and UK
          consumer rights where they apply. Failed payments may suspend access
          after notice.
        </p>
      </section>

      <section>
        <h2>AI features</h2>
        <p>
          AI outputs are provided &quot;as is&quot; for assistance only. You
          must review AI-generated content before relying on it or sending it to
          clients, regulators, or third parties — including drafts, summaries,
          proposals, and email replies. You must not rely on AI outputs alone
          for legal, financial, medical, or compliance decisions. You grant us a
          limited licence to process inputs to provide the service.
        </p>
      </section>

      <section>
        <h2>Termination and deletion</h2>
        <p>
          You may cancel your subscription via the billing portal or by
          contacting us. After termination we will cease providing the service.
          Customer data may reside in Supabase (database and storage), Bunny.net
          (video binaries), and Stripe (billing and Connect records).
        </p>
        <p>
          <strong>Deletion timeframe:</strong> [LEGAL REVIEW NEEDED — TBD]. We
          do not silently purge all customer data on cancel without a confirmed
          retention and deletion policy; billing systems may retain records
          required for tax and dispute resolution.
        </p>
      </section>

      <section>
        <h2>Liability</h2>
        <p>
          To the fullest extent permitted by law, our liability is limited to
          fees paid in the 12 months before the claim. Nothing limits liability
          for death, personal injury, fraud, or other rights that cannot be
          excluded under UK/EU law. Data protection liability between the
          parties may be further addressed in the DPA [LEGAL REVIEW NEEDED —
          liability caps].
        </p>
      </section>

      <section>
        <h2>Governing law</h2>
        <p>
          These Terms are governed by the laws of England and Wales. Courts of
          England and Wales have exclusive jurisdiction, without prejudice to
          mandatory consumer rights in your country of residence.
        </p>
      </section>
    </article>
  );
}

export function CookiePolicyContent() {
  return (
    <article className={legalProseClass}>
      <p>
        <strong>Last updated:</strong> 15 June 2026. Oodle Designs Ltd
        (&quot;Ozer&quot;) uses cookies and similar technologies on ozer.so and
        related services. This policy explains what we use and how you can
        control them.
      </p>

      <section>
        <h2>Essential cookies</h2>
        <p>
          Required for sign-in, security (including CSRF protection), load
          balancing, and remembering your cookie preferences. These cannot be
          switched off if you use the product.
        </p>
      </section>

      <section>
        <h2>Analytics cookies</h2>
        <p>
          With your consent we may use analytics cookies to understand how pages
          are used and improve the product. You can withdraw consent at any time
          via the cookie banner or your browser settings.
        </p>
      </section>

      <section>
        <h2>Preferences</h2>
        <p>
          We may store preferences such as theme (light/dark) and locale so the
          site remembers your choices between visits.
        </p>
      </section>

      <section>
        <h2>Managing cookies</h2>
        <p>
          Most browsers let you block or delete cookies. Blocking essential
          cookies may prevent sign-in and core features from working. For
          privacy questions contact privacy@ozer.so.
        </p>
      </section>
    </article>
  );
}

export function DpaContent() {
  return (
    <article className={legalProseClass}>
      <div
        role="alert"
        className="not-prose rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm"
      >
        <strong>Solicitor review required.</strong> This Data Processing
        Agreement is a draft for customer review and must be confirmed by
        counsel before reliance. Placeholders marked [LEGAL REVIEW NEEDED] are
        intentional.
      </div>

      <p>
        <strong>Version:</strong> 16 July 2026. Operated by Oodle Designs Ltd
        (&quot;Processor&quot; / &quot;Ozer&quot;). A downloadable copy is at{' '}
        <LegalLink href="/legal/ozer-dpa.md">/legal/ozer-dpa.md</LegalLink>.
      </p>

      <section>
        <h2>1. Roles and subject matter</h2>
        <p>
          This DPA applies where the customer (&quot;Controller&quot;) uses Ozer
          to process personal data and Ozer acts as processor. Ozer remains
          controller for account/auth data, product analytics and security logs,
          and SaaS billing customer records. Dual-role processing is described
          in Annex A.
        </p>
      </section>

      <section>
        <h2>2. Duration</h2>
        <p>
          This DPA applies for the term of the Controller&apos;s agreement with
          Ozer and until deletion or return of personal data as set out below.
        </p>
      </section>

      <section>
        <h2>3. Nature and purpose of processing</h2>
        <p>
          Processing is for providing the Ozer workspace and related features
          (CRM, invoicing, email assist, calendar, bookings, transcripts,
          activity tracking, signatures, AI features, transactional email,
          video, MCP access) as enabled by the Controller. Categories are in
          Annex A.
        </p>
      </section>

      <section>
        <h2>4. Types of personal data and data subjects</h2>
        <p>See Annex A (exhaustive list from the product inventory).</p>
      </section>

      <section>
        <h2>5. Obligations of the Processor</h2>
        <p>Ozer shall:</p>
        <ul>
          <li>
            process personal data only on documented instructions from the
            Controller, including with regard to transfers, unless required by
            UK/EU law;
          </li>
          <li>
            ensure persons authorised to process personal data are bound by
            confidentiality;
          </li>
          <li>
            implement appropriate technical and organisational measures (see
            Trust Centre);
          </li>
          <li>
            respect the conditions for engaging sub-processors (Section 6 and
            Annex B);
          </li>
          <li>
            taking into account the nature of processing, assist the Controller
            with data subject rights requests;
          </li>
          <li>
            assist the Controller with security, breach notification, and DPIA /
            prior consultation obligations, taking into account the nature of
            processing and information available to Ozer;
          </li>
          <li>
            at the choice of the Controller, delete or return personal data
            after the end of processing services, and delete existing copies
            unless UK/EU law requires storage —{' '}
            <strong>
              deletion timeframe: [LEGAL REVIEW NEEDED — TBD days]
            </strong>
            ;
          </li>
          <li>
            make available information necessary to demonstrate compliance and
            allow audits [LEGAL REVIEW NEEDED — audit frequency / notice
            period].
          </li>
        </ul>
      </section>

      <section>
        <h2>6. Sub-processors</h2>
        <p>
          The Controller authorises Ozer to engage the sub-processors listed in
          Annex B. Ozer will notify the Controller of intended changes to
          sub-processors [LEGAL REVIEW NEEDED — TBD notice period, e.g. 14/30
          days] via the Trust Centre and/or email, and give the Controller an
          opportunity to object on reasonable grounds.
        </p>
      </section>

      <section>
        <h2>7. International transfers</h2>
        <p>
          [LEGAL REVIEW NEEDED — TBD: transfer tools (SCCs / UK IDTA / adequacy)
          for Anthropic, Google, Microsoft, Soniox, Voyage, Bunny, and others.
          Do not assert execution of SCCs/IDTA until confirmed.]
        </p>
      </section>

      <section>
        <h2>8. Security</h2>
        <p>
          Measures include encryption in transit (TLS 1.2+), encryption at rest
          (AES-256 via Supabase/AWS), Row-Level Security, and access controls as
          described in the Trust Centre. OAuth tokens for Google integrations
          are encrypted with AES-256-GCM where that encryption path is
          implemented.
        </p>
      </section>

      <section>
        <h2>9. Personal data breaches</h2>
        <p>
          Ozer will notify the Controller without undue delay after becoming
          aware of a personal data breach affecting Controller personal data.
          Target notification window:{' '}
          <strong>[LEGAL REVIEW NEEDED — TBD hours]</strong> (regulatory outer
          limit for controller notification to the ICO remains 72 hours where
          applicable to the controller).
        </p>
      </section>

      <section>
        <h2>10. Liability</h2>
        <p>
          [LEGAL REVIEW NEEDED — TBD: liability caps, indemnities, and
          relationship to the limitation of liability in the Terms of Service.]
        </p>
      </section>

      <section>
        <h2>11. Governing law</h2>
        <p>
          This DPA is governed by the laws of England and Wales, unless
          mandatory data protection law requires otherwise.
        </p>
      </section>

      <section>
        <h2>12. Order of precedence</h2>
        <p>
          On data protection processing matters, this DPA prevails over the
          Terms of Service. The Privacy Policy describes Ozer&apos;s practices
          but does not reduce Article 28 obligations.
        </p>
      </section>

      <section>
        <h2>Annex A — Categories of personal data</h2>
        <ul>
          <li>
            Account users: name, email, auth identifiers, workspace membership.
          </li>
          <li>
            CRM: clients and contacts (name, email, phone, address, picture);
            tasks/notes/projects links.
          </li>
          <li>
            Invoicing / proposals / contracts: recipient emails, templates, PDF
            metadata, portal tokens.
          </li>
          <li>
            Email Assistant: OAuth tokens; email threads/messages (body text and
            HTML); drafts; action items.
          </li>
          <li>Calendar: events and attendees via connected Google Calendar.</li>
          <li>
            Bookings: invitee name, email, timezone, notes, guests, form
            answers, management tokens.
          </li>
          <li>
            Meeting transcripts: content, speaker segments/mappings, attendee
            emails, summaries, action items.
          </li>
          <li>
            Activity: app name, bundle ID, domain, optional URL, window title,
            durations (no keystrokes/audio/screens).
          </li>
          <li>
            Signatures: staff name, email, job title, department, phones,
            photos, signature HTML, MS/Google tokens.
          </li>
          <li>
            Billing: billing customer and subscription status (no PAN);
            Connect IDs and bank instruction fields.
          </li>
          <li>
            AI: workspace text prompts for feature outputs; credit logs of
            tokens/model only.
          </li>
          <li>
            Transactional email: to/from/subject/html and platform email log
            metadata.
          </li>
          <li>
            Video: title, description, filename, Bunny IDs and media binaries.
          </li>
          <li>
            MCP: tasks, projects, deals, clients, notes (RLS-scoped; not email
            bodies).
          </li>
        </ul>
      </section>

      <section>
        <h2>Annex B — Sub-processor schedule</h2>
        <p>
          Same register as the Privacy Policy and Trust Centre: Supabase/AWS,
          Stripe, Anthropic, Google, Microsoft Graph, ZeptoMail, Bunny.net,
          Voyage AI, Soniox. Composio is excluded (not built). Change
          notification mechanism: [LEGAL REVIEW NEEDED — TBD].
        </p>
      </section>
    </article>
  );
}
