import Link from 'next/link';

import { Shield } from 'lucide-react';

import { Badge } from '@kit/ui/badge';

import appConfig from '~/config/app.config';
import { withI18n } from '~/lib/i18n/with-i18n';
import { JsonLd } from '~/lib/seo/json-ld';
import { buildMarketingMetadata } from '~/lib/seo/marketing-metadata';
import { breadcrumbJsonLd, schemaGraph, webPageJsonLd } from '~/lib/seo/schema';

import {
  TrustCenterMobileNav,
  TrustCenterNav,
} from './_components/trust-center-nav';

const mutedLeadClass =
  'text-muted-foreground text-lg leading-relaxed tracking-tight 2xl:text-xl';

export const metadata = buildMarketingMetadata({
  title: 'Trust Centre and security — Ozer',
  description:
    'How Ozer protects workspace data: EU residency, UK GDPR, Stripe payments, and Mac meeting audio that is not kept as a permanent recording.',
  path: '/trust',
  ogType: 'legal',
});

const proseSectionClass =
  'scroll-mt-28 space-y-6 border-b border-border/40 pb-12 last:border-b-0';
const h2Class =
  'font-heading text-2xl font-semibold tracking-tight text-foreground';
const h3Class = 'text-foreground text-base font-semibold';
const pClass = 'text-muted-foreground text-sm leading-relaxed';

function TrustEmail({
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

function TrustCenterPage() {
  return (
    <div className="border-border/40 border-b">
      <JsonLd
        data={schemaGraph([
          webPageJsonLd({
            name: 'Trust Centre and security — Ozer',
            description:
              'How Ozer protects workspace data: EU residency, UK GDPR, and Mac meeting audio.',
            path: '/trust',
          }),
          breadcrumbJsonLd([
            { name: 'Home', path: '/' },
            { name: 'Trust Centre', path: '/trust' },
          ]),
        ])}
      />
      <div className="container mx-auto px-4 py-10 xl:py-14">
        <div className="mx-auto flex max-w-3xl flex-col items-center gap-4 text-center">
          <div className="bg-muted/60 text-muted-foreground flex h-12 w-12 items-center justify-center rounded-full">
            <Shield className="h-6 w-6" aria-hidden />
          </div>
          <h1 className="font-heading text-3xl tracking-tighter xl:text-5xl">
            {appConfig.name} Trust Centre
          </h1>
          <p className={mutedLeadClass}>
            Security and data protection are foundational to {appConfig.name}.
            We&apos;re committed to keeping your client data, business
            information, and team communications safe — and being transparent
            about how we do it.
          </p>
          <p className="text-muted-foreground text-xs tracking-wide uppercase">
            Last updated: 18 August 2026
          </p>
        </div>
      </div>

      <div className="container mx-auto px-4 pt-4 pb-16 lg:pb-24">
        <TrustCenterMobileNav />

        <div className="lg:grid lg:grid-cols-[220px_minmax(0,1fr)] lg:gap-12 xl:grid-cols-[240px_minmax(0,1fr)] xl:gap-16">
          <aside className="hidden lg:block">
            <div className="sticky top-24">
              <TrustCenterNav />
            </div>
          </aside>

          <div className="max-w-3xl space-y-12 pt-6 lg:pt-0">
            <section id="compliance" className={proseSectionClass}>
              <h2 className={h2Class}>Compliance</h2>

              <div className="flex flex-wrap gap-2 pt-1">
                <Badge
                  variant="outline"
                  className="text-muted-foreground border-dashed font-normal"
                >
                  SOC 2 — planned
                </Badge>
                <Badge
                  variant="outline"
                  className="text-muted-foreground border-dashed font-normal"
                >
                  ISO 27001 — via AWS
                </Badge>
              </div>

              <div className="space-y-6 pt-2">
                <div>
                  <h3 className={h3Class}>GDPR</h3>
                  <p className={pClass}>
                    {appConfig.name} is designed to comply with the UK GDPR, EU
                    GDPR, and the Data Protection Act 2018. We act as a{' '}
                    <strong>processor</strong> for personal data you store in
                    your workspace (for example clients, notes, and transcripts)
                    and as a <strong>controller</strong> for account and
                    authentication data, product analytics and security logs,
                    and SaaS billing records. We do not sell your data to third
                    parties.
                  </p>
                </div>

                <div>
                  <h3 className={h3Class}>UK ICO Registration</h3>
                  <p className={pClass}>
                    {appConfig.name} is operated by Oodle Designs Ltd, a UK
                    registered company. We are registered with the UK
                    Information Commissioner&apos;s Office (ICO) as a data
                    controller.
                  </p>
                </div>

                <div>
                  <h3 className={h3Class}>Data Processing Agreement</h3>
                  <p className={pClass}>
                    Our Data Processing Agreement (UK GDPR Article 28) is in
                    effect for business customers and is available at{' '}
                    <Link
                      href="/dpa"
                      className="text-primary font-medium underline-offset-4 hover:underline"
                    >
                      /dpa
                    </Link>{' '}
                    and as a downloadable file at{' '}
                    <Link
                      href="/legal/ozer-dpa.md"
                      className="text-primary font-medium underline-offset-4 hover:underline"
                    >
                      /legal/ozer-dpa.md
                    </Link>
                    . Counsel review of the full agreement remains in progress.
                    Questions:{' '}
                    <TrustEmail href="mailto:privacy@ozer.so">
                      privacy@ozer.so
                    </TrustEmail>
                    .
                  </p>
                </div>

                <div>
                  <h3 className={h3Class}>Google API Limited Use</h3>
                  <p className={pClass}>
                    {appConfig.name}&apos;s use of information received from
                    Google Workspace APIs adheres to the Google API Services
                    User Data Policy, including the Limited Use requirements.
                    See the{' '}
                    <Link
                      href="/privacy-policy"
                      className="text-primary font-medium underline-offset-4 hover:underline"
                    >
                      Privacy Policy
                    </Link>
                    .
                  </p>
                </div>

                <div>
                  <h3 className={h3Class}>SOC 2 Type II (Roadmap)</h3>
                  <p className={pClass}>
                    We are working toward SOC 2 Type II certification. Our
                    infrastructure provider (Supabase/AWS) already holds SOC 2
                    Type II certification — details available at{' '}
                    <Link
                      href="https://supabase.com/security"
                      className="text-primary underline-offset-4 hover:underline"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      supabase.com/security
                    </Link>
                    .
                  </p>
                </div>
              </div>
            </section>

            <section id="sub-processors" className={proseSectionClass}>
              <h2 className={h2Class}>Sub-processors</h2>
              <p className={pClass}>
                Ozer engages the following sub-processors to deliver the
                service. This register matches our{' '}
                <Link
                  href="/privacy-policy"
                  className="text-primary font-medium underline-offset-4 hover:underline"
                >
                  Privacy Policy
                </Link>{' '}
                and{' '}
                <Link
                  href="/dpa"
                  className="text-primary font-medium underline-offset-4 hover:underline"
                >
                  DPA
                </Link>
                . Integrations that are not yet shipped are excluded.
              </p>
              <div className="overflow-x-auto pt-2">
                <table className="w-full border-collapse text-left text-sm">
                  <thead>
                    <tr className="border-border border-b">
                      <th
                        scope="col"
                        className="text-foreground py-2 pr-3 font-semibold"
                      >
                        Name
                      </th>
                      <th
                        scope="col"
                        className="text-foreground py-2 pr-3 font-semibold"
                      >
                        Purpose
                      </th>
                      <th
                        scope="col"
                        className="text-foreground py-2 pr-3 font-semibold"
                      >
                        Data (high level)
                      </th>
                      <th
                        scope="col"
                        className="text-foreground py-2 font-semibold"
                      >
                        Location &amp; transfer mechanism
                      </th>
                    </tr>
                  </thead>
                  <tbody className="text-muted-foreground">
                    <tr className="border-border/60 border-b">
                      <td className="py-2.5 pr-3 align-top">Supabase</td>
                      <td className="py-2.5 pr-3 align-top">
                        Database, auth, storage (hosted on AWS EU West)
                      </td>
                      <td className="py-2.5 pr-3 align-top">
                        Workspace and account data
                      </td>
                      <td className="py-2.5 align-top">
                        EU West (Ireland) — no restricted transfer
                      </td>
                    </tr>
                    <tr className="border-border/60 border-b">
                      <td className="py-2.5 pr-3 align-top">
                        Amazon Web Services (AWS)
                      </td>
                      <td className="py-2.5 pr-3 align-top">
                        Amazon SES for workspace sending domains and
                        circulation email; cloud infrastructure underlying EU
                        hosting
                      </td>
                      <td className="py-2.5 pr-3 align-top">
                        Sender/recipient addresses, subject, and body for SES
                        mail; infrastructure for hosted data
                      </td>
                      <td className="py-2.5 align-top">
                        EU (Ireland and other AWS EU regions we configure) —
                        no restricted transfer
                      </td>
                    </tr>
                    <tr className="border-border/60 border-b">
                      <td className="py-2.5 pr-3 align-top">Stripe</td>
                      <td className="py-2.5 pr-3 align-top">
                        SaaS billing and Connect payments
                      </td>
                      <td className="py-2.5 pr-3 align-top">
                        Customer IDs, subscription status; card numbers stay
                        with Stripe
                      </td>
                      <td className="py-2.5 align-top">
                        US — Stripe Data Transfers Addendum (UK IDTA
                        incorporated; EU-US Data Privacy Framework incl. UK
                        Extension)
                      </td>
                    </tr>
                    <tr className="border-border/60 border-b">
                      <td className="py-2.5 pr-3 align-top">Anthropic</td>
                      <td className="py-2.5 pr-3 align-top">
                        AI language model features
                      </td>
                      <td className="py-2.5 pr-3 align-top">
                        Workspace / email / transcript text prompts
                      </td>
                      <td className="py-2.5 align-top">
                        US — DPA with EU SCCs and UK Addendum; EU-US Data
                        Privacy Framework
                      </td>
                    </tr>
                    <tr className="border-border/60 border-b">
                      <td className="py-2.5 pr-3 align-top">
                        Google (Gemini Flash / Flash-Lite)
                      </td>
                      <td className="py-2.5 pr-3 align-top">
                        High-volume AI (email triage/extract and other
                        Flash-Lite routes)
                      </td>
                      <td className="py-2.5 pr-3 align-top">
                        Workspace / email text prompts
                      </td>
                      <td className="py-2.5 align-top">
                        US/global — Paid Gemini API under Google Data Processing
                        Addendum (EU SCCs and UK Addendum); EU-US Data Privacy
                        Framework (Google LLC). Free AI Studio tier is not used
                        for customer personal data.
                      </td>
                    </tr>
                    <tr className="border-border/60 border-b">
                      <td className="py-2.5 pr-3 align-top">
                        Google Workspace APIs
                      </td>
                      <td className="py-2.5 pr-3 align-top">
                        Gmail, Calendar, Workspace directory
                      </td>
                      <td className="py-2.5 pr-3 align-top">
                        Mailbox, calendar, and directory data
                      </td>
                      <td className="py-2.5 align-top">
                        US/global — Google Data Processing Terms (SCCs and UK
                        Addendum incorporated)
                      </td>
                    </tr>
                    <tr className="border-border/60 border-b">
                      <td className="py-2.5 pr-3 align-top">Microsoft</td>
                      <td className="py-2.5 pr-3 align-top">
                        Signatures directory sync
                      </td>
                      <td className="py-2.5 pr-3 align-top">
                        Staff profile and photo data
                      </td>
                      <td className="py-2.5 align-top">
                        US/global — Microsoft Products and Services Data
                        Protection Addendum (SCCs and UK Addendum incorporated)
                      </td>
                    </tr>
                    <tr className="border-border/60 border-b">
                      <td className="py-2.5 pr-3 align-top">
                        ZeptoMail (Zoho)
                      </td>
                      <td className="py-2.5 pr-3 align-top">
                        Transactional email
                      </td>
                      <td className="py-2.5 pr-3 align-top">
                        Recipient, subject, message body
                      </td>
                      <td className="py-2.5 align-top">
                        EU data centre — Zoho DPA with standard contractual
                        clauses
                      </td>
                    </tr>
                    <tr className="border-border/60 border-b">
                      <td className="py-2.5 pr-3 align-top">
                        Bunny.net (BunnyWay d.o.o.)
                      </td>
                      <td className="py-2.5 pr-3 align-top">
                        Video hosting and streaming
                      </td>
                      <td className="py-2.5 pr-3 align-top">
                        Media files and video metadata
                      </td>
                      <td className="py-2.5 align-top">
                        Slovenia (EU) — EU-headquartered; DPA in place; EU
                        storage region
                      </td>
                    </tr>
                    <tr className="border-border/60 border-b">
                      <td className="py-2.5 pr-3 align-top">Mapbox</td>
                      <td className="py-2.5 pr-3 align-top">
                        Commercial listing maps and address geocoding
                      </td>
                      <td className="py-2.5 pr-3 align-top">
                        Addresses and map coordinates
                      </td>
                      <td className="py-2.5 align-top">
                        US/global — Mapbox Data Processing Agreement (SCCs / UK
                        Addendum as applicable)
                      </td>
                    </tr>
                    <tr className="border-border/60 border-b">
                      <td className="py-2.5 pr-3 align-top">Voyage AI</td>
                      <td className="py-2.5 pr-3 align-top">
                        Semantic search embeddings
                      </td>
                      <td className="py-2.5 pr-3 align-top">
                        Text excerpts and search queries
                      </td>
                      <td className="py-2.5 align-top">
                        US — Voyage AI DPA with EU SCCs and UK ICO Addendum
                      </td>
                    </tr>
                    <tr>
                      <td className="py-2.5 pr-3 align-top">PostHog, Inc.</td>
                      <td className="py-2.5 pr-3 align-top">
                        Product analytics, feature flags, error/session
                        diagnostics, and session replay
                      </td>
                      <td className="py-2.5 pr-3 align-top">
                        Usage events, device/browser data, user/account
                        identifiers; UI session recordings (inputs masked;
                        30-day recording retention)
                      </td>
                      <td className="py-2.5 align-top">
                        EU (PostHog EU Cloud) — PostHog DPA with EU SCCs and UK
                        Addendum
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <p className={`${pClass} pt-4`}>
                We give at least <strong>30 days&apos; notice</strong> of
                intended additions or replacements of sub-processors, via update
                to this Trust Centre register and, for material changes, by
                email to the Controller&apos;s account contact, with an
                opportunity to object on reasonable grounds (see the{' '}
                <Link
                  href="/dpa"
                  className="text-primary font-medium underline-offset-4 hover:underline"
                >
                  DPA
                </Link>
                ).
              </p>
            </section>

            <section id="infrastructure" className={proseSectionClass}>
              <h2 className={h2Class}>Infrastructure &amp; Hosting</h2>

              <div className="space-y-6">
                <div>
                  <h3 className={h3Class}>Cloud Infrastructure</h3>
                  <p className={pClass}>
                    {appConfig.name} is hosted on Supabase, which runs on Amazon
                    Web Services (AWS). AWS maintains ISO 27001, SOC 1, SOC 2,
                    and SOC 3 certifications. Supabase itself holds SOC 2 Type
                    II certification.
                  </p>
                </div>

                <div>
                  <h3 className={h3Class}>Physical Access Control</h3>
                  <p className={pClass}>
                    {appConfig.name} has no physical servers. All infrastructure
                    is managed by Supabase/AWS, which operate enterprise-grade
                    data centres with strict physical access controls.
                  </p>
                </div>

                <div>
                  <h3 className={h3Class}>Access Control</h3>
                  <p className={pClass}>
                    Access to {appConfig.name}&apos;s production database and
                    infrastructure is restricted to authorised team members
                    only. All access requires strong authentication. Database
                    administration access is audited.
                  </p>
                </div>

                <div>
                  <h3 className={h3Class}>Row-Level Security</h3>
                  <p className={pClass}>
                    Data tables in {appConfig.name} enforce Row-Level Security
                    (RLS) policies at the database level so workspace data is
                    scoped to the correct account and cannot be accessed across
                    workspaces via the standard application path.
                  </p>
                </div>

                <div>
                  <h3 className={h3Class}>Penetration Testing</h3>
                  <p className={pClass}>
                    We plan to conduct annual third-party penetration testing as
                    we approach general availability. Customers with specific
                    security assessment requirements should contact us at{' '}
                    <TrustEmail href="mailto:security@ozer.so">
                      security@ozer.so
                    </TrustEmail>
                    .
                  </p>
                </div>
              </div>
            </section>

            <section id="data-flow" className={proseSectionClass}>
              <h2 className={h2Class}>Data Flow</h2>

              <div className="space-y-6">
                <div>
                  <h3 className={h3Class}>Data in Transit</h3>
                  <p className={pClass}>
                    All data sent to and from {appConfig.name} is encrypted in
                    transit using HTTPS with TLS 1.2 or higher.
                  </p>
                </div>

                <div>
                  <h3 className={h3Class}>Data at Rest</h3>
                  <p className={pClass}>
                    Data stored in {appConfig.name} is encrypted at rest using
                    AES-256 encryption via our Supabase/AWS infrastructure.
                  </p>
                </div>

                <div>
                  <h3 className={h3Class}>OAuth token security</h3>
                  <p className={pClass}>
                    OAuth access and refresh tokens for Google integrations
                    (including Gmail Email Assistant and Google Calendar) are
                    encrypted at the application layer using AES-256-GCM before
                    storage. Microsoft 365 Signatures connection tokens are
                    stored in our database without a separate application-layer
                    wrap and rely on AES-256 encryption at rest. Tokens are
                    deleted when you disconnect the integration.
                  </p>
                </div>

                <div>
                  <h3 className={h3Class}>Data Residency &amp; transfers</h3>
                  <p className={pClass}>
                    Primary customer data storage is in AWS EU West (Ireland).
                    Where a sub-processor processes personal data outside the
                    UK/EEA, we rely on the transfer mechanisms listed in the
                    sub-processor table above — UK International Data Transfer
                    Addendum and/or EU Standard Contractual Clauses incorporated
                    into each provider&apos;s data processing terms, and, where
                    applicable, the EU-US Data Privacy Framework and its UK
                    Extension.
                  </p>
                </div>

                <div>
                  <h3 className={h3Class}>Backups</h3>
                  <p className={pClass}>
                    Supabase maintains automated daily database backups with
                    point-in-time recovery. Backups are stored in encrypted form
                    across multiple availability zones.
                  </p>
                </div>

                <div>
                  <h3 className={h3Class}>Retention</h3>
                  <p className={pClass}>
                    Feature-specific retention periods are set out in the{' '}
                    <Link
                      href="/privacy-policy"
                      className="text-primary font-medium underline-offset-4 hover:underline"
                    >
                      Privacy Policy
                    </Link>
                    . Ending a subscription does not delete your workspace. On
                    account deletion we remove customer data across our systems
                    within 30 days (database rows immediately; remaining files
                    at the end of that window, after warning emails). Records we
                    must keep for legal reasons are retained (for example,
                    billing records for 6 years for tax purposes).
                  </p>
                </div>
              </div>
            </section>

            <section id="application-security" className={proseSectionClass}>
              <h2 className={h2Class}>Application Security</h2>

              <div className="space-y-6">
                <div>
                  <h3 className={h3Class}>Authentication</h3>
                  <p className={pClass}>
                    {appConfig.name} uses Supabase Auth for user authentication.
                    Passwords are never stored in plain text. We support:
                  </p>
                  <ul className="text-muted-foreground mt-3 list-disc space-y-1.5 pl-5 text-sm leading-relaxed">
                    <li>Email + password (with secure hashing via bcrypt)</li>
                    <li>Magic link / OTP login</li>
                    <li>Google OAuth (planned)</li>
                    <li>SAML/SSO (on roadmap for agency plans)</li>
                  </ul>
                </div>

                <div>
                  <h3 className={h3Class}>API Security</h3>
                  <p className={pClass}>
                    All {appConfig.name} API routes are authenticated. API keys
                    are scoped and revocable. Rate limiting is applied to all
                    public-facing endpoints.
                  </p>
                </div>

                <div>
                  <h3 className={h3Class}>Secure Development</h3>
                  <p className={pClass}>
                    All code changes to {appConfig.name} go through version
                    control on GitHub, peer review, and automated testing before
                    deployment. We follow OWASP secure development guidelines.
                  </p>
                </div>

                <div>
                  <h3 className={h3Class}>Dependency Management</h3>
                  <p className={pClass}>
                    We regularly audit our dependencies for known
                    vulnerabilities using automated tooling. Critical
                    vulnerabilities are patched on a priority basis.
                  </p>
                </div>
              </div>
            </section>

            <section id="business-continuity" className={proseSectionClass}>
              <h2 className={h2Class}>Business Continuity</h2>

              <div className="space-y-6">
                <div>
                  <h3 className={h3Class}>High Availability</h3>
                  <p className={pClass}>
                    {appConfig.name} is deployed on infrastructure designed for
                    high availability. Supabase/AWS provides automatic failover
                    across multiple availability zones.
                  </p>
                </div>

                <div>
                  <h3 className={h3Class}>Disaster Recovery</h3>
                  <p className={pClass}>
                    We maintain documented procedures for disaster recovery. In
                    the event of a significant incident, we can restore service
                    from automated backups.
                  </p>
                </div>

                <div>
                  <h3 className={h3Class}>Incident Response</h3>
                  <p className={pClass}>
                    {appConfig.name} has a documented Security Incident Response
                    process. Where a personal data breach affects Controller
                    personal data, we notify the Controller without undue delay
                    and in any event within 72 hours of becoming aware, in line
                    with our{' '}
                    <Link
                      href="/dpa"
                      className="text-primary font-medium underline-offset-4 hover:underline"
                    >
                      DPA
                    </Link>
                    .
                  </p>
                </div>

                <div>
                  <h3 className={h3Class}>Status Page</h3>
                  <p className={pClass}>
                    Our live status page is available at{' '}
                    <Link
                      href="https://status.ozer.so"
                      className="text-primary underline-offset-4 hover:underline"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      status.ozer.so
                    </Link>
                    .
                  </p>
                </div>
              </div>
            </section>

            <section
              id="vulnerability-disclosure"
              className={proseSectionClass}
            >
              <h2 className={h2Class}>Vulnerability Disclosure</h2>

              <div className="space-y-6">
                <div>
                  <h3 className={h3Class}>Reporting a Vulnerability</h3>
                  <p className={pClass}>
                    We take security disclosures seriously. If you discover a
                    vulnerability in {appConfig.name}, please report it to us at{' '}
                    <TrustEmail href="mailto:security@ozer.so">
                      security@ozer.so
                    </TrustEmail>
                    .
                  </p>
                  <p className={`${pClass} mt-3`}>We ask that you:</p>
                  <ul className="text-muted-foreground mt-3 list-disc space-y-1.5 pl-5 text-sm leading-relaxed">
                    <li>
                      Do not publicly disclose the vulnerability before
                      we&apos;ve had a chance to investigate and fix it
                    </li>
                    <li>Provide enough detail for us to reproduce the issue</li>
                    <li>
                      Act in good faith and avoid accessing or modifying other
                      users&apos; data
                    </li>
                  </ul>
                  <p className={`${pClass} mt-3`}>
                    We will acknowledge your report within 2 business days, and
                    will keep you updated as we investigate and resolve the
                    issue.
                  </p>
                </div>
              </div>
            </section>

            <section id="contact" className={proseSectionClass}>
              <h2 className={h2Class}>Contact</h2>
              <div className="space-y-4">
                <p className={pClass}>
                  For any security or privacy questions, contact us at{' '}
                  <TrustEmail href="mailto:security@ozer.so">
                    security@ozer.so
                  </TrustEmail>
                  .
                </p>
                <p className={pClass}>
                  For DPA requests or GDPR queries, contact{' '}
                  <TrustEmail href="mailto:privacy@ozer.so">
                    privacy@ozer.so
                  </TrustEmail>
                  .
                </p>
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}

export default withI18n(TrustCenterPage);
