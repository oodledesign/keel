const legalProseClass =
  'prose prose-neutral dark:prose-invert max-w-3xl space-y-6 text-sm leading-relaxed';

export function PrivacyPolicyContent() {
  return (
    <article className={legalProseClass}>
      <p>
        <strong>Last updated:</strong> 15 June 2026. Oodle Designs Ltd (&quot;Ozer&quot;,
        &quot;we&quot;, &quot;us&quot;) is the data controller for personal data processed
        through ozer.so and related services. We comply with the UK GDPR, EU GDPR, and
        the Data Protection Act 2018.
      </p>

      <section>
        <h2>What we collect</h2>
        <ul>
          <li>Account details: name, email, password hash, workspace membership.</li>
          <li>Workspace content you create: tasks, notes, clients, invoices, files.</li>
          <li>Billing data processed by Stripe (we do not store full card numbers).</li>
          <li>Usage, device, and security logs; optional analytics cookies with consent.</li>
          <li>AI feature inputs and outputs where you use Ozer AI (Second Brain, task extract, etc.).</li>
        </ul>
      </section>

      <section>
        <h2>Lawful bases</h2>
        <p>
          We process data to perform our contract with you, for legitimate interests
          (security, product improvement), with consent where required (marketing/analytics
          cookies), and to meet legal obligations (tax, fraud prevention).
        </p>
      </section>

      <section>
        <h2>AI processing</h2>
        <p>
          When you use AI features, relevant workspace content may be sent to our AI
          subprocessors to generate responses. We do not use your private workspace data to
          train public foundation models. You should not submit special category data unless
          you have a lawful basis and appropriate safeguards. EU AI Act transparency: AI
          outputs are assistive and may be inaccurate — you remain responsible for decisions
          made in your business.
        </p>
      </section>

      <section>
        <h2>Payments</h2>
        <p>
          Payments are handled by Stripe Payments Europe Ltd (or Stripe UK as applicable).
          See Stripe&apos;s privacy notice for card processing. We receive billing status,
          customer IDs, and invoice metadata.
        </p>
      </section>

      <section>
        <h2>International transfers</h2>
        <p>
          Where data leaves the UK/EEA we use appropriate safeguards such as Standard
          Contractual Clauses and vendor DPAs.
        </p>
      </section>

      <section>
        <h2>Retention &amp; rights</h2>
        <p>
          We retain data while your account is active and as required by law. You may
          access, rectify, erase, restrict, object, or port your data, and lodge a complaint
          with the ICO (UK) or your local supervisory authority. Contact: privacy@ozer.so.
        </p>
      </section>
    </article>
  );
}

export function TermsOfServiceContent() {
  return (
    <article className={legalProseClass}>
      <p>
        <strong>Last updated:</strong> 15 June 2026. These Terms govern use of Ozer
        operated by Oodle Designs Ltd. By creating an account and accepting these Terms you
        agree to be bound by them.
      </p>

      <section>
        <h2>Service</h2>
        <p>
          Ozer provides workspace software for personal and business productivity including
          optional paid plans and marketplace apps. Features may change; we will give
          reasonable notice of material changes.
        </p>
      </section>

      <section>
        <h2>Accounts &amp; acceptable use</h2>
        <p>
          You must provide accurate information, keep credentials secure, and use Ozer
          lawfully. You are responsible for content in your workspaces and for inviting
          team members in line with your plan limits.
        </p>
      </section>

      <section>
        <h2>Subscriptions &amp; payments</h2>
        <p>
          Paid plans renew automatically via Stripe until cancelled. Prices include VAT
          where applicable. Refunds follow our billing policy and UK consumer rights where
          they apply. Failed payments may suspend access after notice.
        </p>
      </section>

      <section>
        <h2>AI features</h2>
        <p>
          AI outputs are provided &quot;as is&quot; for assistance only. You must review
          AI-generated content before relying on it for legal, financial, medical, or
          compliance decisions. You grant us a limited licence to process inputs to provide
          the service.
        </p>
      </section>

      <section>
        <h2>Liability</h2>
        <p>
          To the fullest extent permitted by law, our liability is limited to fees paid in
          the 12 months before the claim. Nothing limits liability for death, personal
          injury, fraud, or other rights that cannot be excluded under UK/EU law.
        </p>
      </section>

      <section>
        <h2>Governing law</h2>
        <p>
          These Terms are governed by the laws of England and Wales. Courts of England and
          Wales have exclusive jurisdiction, without prejudice to mandatory consumer rights
          in your country of residence.
        </p>
      </section>
    </article>
  );
}
