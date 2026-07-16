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
            Last updated: July 2026
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
                    {appConfig.name} is designed to comply with the UK GDPR and
                    EU GDPR. We act as a Data Processor for the data you store
                    in {appConfig.name}, and as a Data Controller for the
                    account and usage data we collect directly. We do not sell
                    your data to third parties under any circumstances.
                  </p>
                </div>

                <div>
                  <h3 className={h3Class}>UK ICO Registration</h3>
                  <p className={pClass}>
                    {appConfig.name} is operated by Oodle Design Ltd, a UK
                    registered company. We are registered with the UK
                    Information Commissioner&apos;s Office (ICO) as a data
                    controller.
                  </p>
                </div>

                <div>
                  <h3 className={h3Class}>Data Processing Agreement</h3>
                  <p className={pClass}>
                    Our standalone Data Processing Agreement (UK GDPR Article
                    28) is available at{' '}
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
                    . Questions:{' '}
                    <TrustEmail href="mailto:privacy@ozer.so">
                      privacy@ozer.so
                    </TrustEmail>
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
                        Location note
                      </th>
                    </tr>
                  </thead>
                  <tbody className="text-muted-foreground">
                    <tr className="border-border/60 border-b">
                      <td className="py-2.5 pr-3 align-top">Supabase / AWS</td>
                      <td className="py-2.5 pr-3 align-top">
                        Database, auth, storage
                      </td>
                      <td className="py-2.5 pr-3 align-top">
                        Workspace and account data
                      </td>
                      <td className="py-2.5 align-top">EU West (Ireland)</td>
                    </tr>
                    <tr className="border-border/60 border-b">
                      <td className="py-2.5 pr-3 align-top">Stripe</td>
                      <td className="py-2.5 pr-3 align-top">
                        SaaS billing and Connect
                      </td>
                      <td className="py-2.5 pr-3 align-top">
                        Customer IDs, subscription status; card PAN stays with
                        Stripe
                      </td>
                      <td className="py-2.5 align-top">
                        [LEGAL REVIEW NEEDED]
                      </td>
                    </tr>
                    <tr className="border-border/60 border-b">
                      <td className="py-2.5 pr-3 align-top">Anthropic</td>
                      <td className="py-2.5 pr-3 align-top">LLM features</td>
                      <td className="py-2.5 pr-3 align-top">
                        Workspace / email / transcript text prompts
                      </td>
                      <td className="py-2.5 align-top">
                        [LEGAL REVIEW NEEDED]
                      </td>
                    </tr>
                    <tr className="border-border/60 border-b">
                      <td className="py-2.5 pr-3 align-top">Google</td>
                      <td className="py-2.5 pr-3 align-top">
                        Gmail, Calendar, Workspace; Gemini if enabled
                      </td>
                      <td className="py-2.5 pr-3 align-top">
                        Mailbox, calendar, directory; AI prompts if wired
                      </td>
                      <td className="py-2.5 align-top">
                        [LEGAL REVIEW NEEDED]
                      </td>
                    </tr>
                    <tr className="border-border/60 border-b">
                      <td className="py-2.5 pr-3 align-top">Microsoft Graph</td>
                      <td className="py-2.5 pr-3 align-top">
                        Signatures directory and mailbox settings
                      </td>
                      <td className="py-2.5 pr-3 align-top">
                        Staff profile, photo, mailbox settings
                      </td>
                      <td className="py-2.5 align-top">
                        [LEGAL REVIEW NEEDED]
                      </td>
                    </tr>
                    <tr className="border-border/60 border-b">
                      <td className="py-2.5 pr-3 align-top">ZeptoMail</td>
                      <td className="py-2.5 pr-3 align-top">
                        Transactional email
                      </td>
                      <td className="py-2.5 pr-3 align-top">
                        Recipient, subject, HTML body
                      </td>
                      <td className="py-2.5 align-top">
                        EU API endpoint used in product
                      </td>
                    </tr>
                    <tr className="border-border/60 border-b">
                      <td className="py-2.5 pr-3 align-top">Bunny.net</td>
                      <td className="py-2.5 pr-3 align-top">
                        Video hosting (Stream)
                      </td>
                      <td className="py-2.5 pr-3 align-top">
                        Media files and video metadata
                      </td>
                      <td className="py-2.5 align-top">
                        [LEGAL REVIEW NEEDED]
                      </td>
                    </tr>
                    <tr className="border-border/60 border-b">
                      <td className="py-2.5 pr-3 align-top">Voyage AI</td>
                      <td className="py-2.5 pr-3 align-top">
                        Embeddings (Second Brain) when keyed
                      </td>
                      <td className="py-2.5 pr-3 align-top">
                        Chunk / query text
                      </td>
                      <td className="py-2.5 align-top">
                        [LEGAL REVIEW NEEDED]
                      </td>
                    </tr>
                    <tr>
                      <td className="py-2.5 pr-3 align-top">Soniox</td>
                      <td className="py-2.5 pr-3 align-top">
                        Cloud realtime STT (web path)
                      </td>
                      <td className="py-2.5 pr-3 align-top">
                        Audio stream / transcript
                      </td>
                      <td className="py-2.5 align-top">
                        [LEGAL REVIEW NEEDED]
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <p className={`${pClass} pt-4`}>
                We will update this page when sub-processors change. Formal
                change-notification timing under the DPA is{' '}
                <strong>[LEGAL REVIEW NEEDED — TBD]</strong>.
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
                    All data tables in {appConfig.name} enforce Row-Level
                    Security (RLS) policies at the database level. This means
                    every query is scoped to the authenticated user&apos;s
                    workspace — it is architecturally impossible for one
                    customer&apos;s data to be accessed by another.
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
                    transit using HTTPS with TLS 1.2 or above. All{' '}
                    {appConfig.name} services reject connections using older TLS
                    versions or insecure cipher suites.
                  </p>
                </div>

                <div>
                  <h3 className={h3Class}>Data at Rest</h3>
                  <p className={pClass}>
                    All data stored in {appConfig.name} is encrypted at rest
                    using AES-256 encryption, managed by Supabase/AWS.
                  </p>
                </div>

                <div>
                  <h3 className={h3Class}>Data Residency</h3>
                  <p className={pClass}>
                    {appConfig.name} data is currently stored in the AWS EU West
                    (Ireland) region. We do not transfer customer data outside
                    of the EU/EEA without appropriate safeguards.
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
                    process. In the event of a security incident affecting
                    customer data confidentiality, we will notify affected
                    customers without undue delay and in compliance with our
                    GDPR obligations (within 72 hours of becoming aware).
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
