import Link from 'next/link';

import { Badge } from '@kit/ui/badge';
import { Shield } from 'lucide-react';

import appConfig from '~/config/app.config';
import { withI18n } from '~/lib/i18n/with-i18n';

import {
  TrustCenterMobileNav,
  TrustCenterNav,
} from './_components/trust-center-nav';

const mutedLeadClass =
  'text-muted-foreground text-lg leading-relaxed tracking-tight 2xl:text-xl';

export const metadata = {
  title: 'Trust Center',
  description:
    'Security, privacy, and compliance information for Ozer — how we protect your data and operate transparently as an early-stage UK SaaS.',
};

const proseSectionClass = 'scroll-mt-28 space-y-6 border-b border-border/40 pb-12 last:border-b-0';
const h2Class = 'font-heading text-2xl font-semibold tracking-tight text-foreground';
const h3Class = 'text-foreground text-base font-semibold';
const pClass = 'text-muted-foreground text-sm leading-relaxed';

function TrustEmail({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="text-primary font-medium underline-offset-4 hover:underline">
      {children}
    </Link>
  );
}

function TrustCenterPage() {
  return (
    <div className="border-border/40 border-b">
      <div className="container mx-auto px-4 py-10 xl:py-14">
        <div className="mx-auto flex max-w-3xl flex-col items-center gap-4 text-center">
          <div className="bg-muted/60 text-muted-foreground flex h-12 w-12 items-center justify-center rounded-full">
            <Shield className="h-6 w-6" aria-hidden />
          </div>
          <h1 className="font-heading text-3xl tracking-tighter xl:text-5xl">
            {appConfig.name} Trust Center
          </h1>
          <p className={mutedLeadClass}>
            Security and data protection are foundational to {appConfig.name}. We&apos;re
            committed to keeping your client data, business information, and team
            communications safe — and being transparent about how we do it.
          </p>
          <p className="text-muted-foreground text-xs tracking-wide uppercase">
            Last updated: June 2025
          </p>
        </div>
      </div>

      <div className="container mx-auto px-4 pb-16 pt-4 lg:pb-24">
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
                    {appConfig.name} is designed to comply with the UK GDPR and EU GDPR. We
                    act as a Data Processor for the data you store in {appConfig.name}, and
                    as a Data Controller for the account and usage data we collect directly.
                    We do not sell your data to third parties under any circumstances.
                  </p>
                </div>

                <div>
                  <h3 className={h3Class}>UK ICO Registration</h3>
                  <p className={pClass}>
                    {appConfig.name} is operated by Oodle Design Ltd, a UK registered
                    company. We are registered with the UK Information Commissioner&apos;s
                    Office (ICO) as a data controller.
                  </p>
                </div>

                <div>
                  <h3 className={h3Class}>Data Processing Agreement</h3>
                  <p className={pClass}>
                    Customers requiring a Data Processing Agreement (DPA) for compliance
                    purposes can request one by contacting{' '}
                    <TrustEmail href="mailto:privacy@ozer.so">privacy@ozer.so</TrustEmail>.
                  </p>
                </div>

                <div>
                  <h3 className={h3Class}>SOC 2 Type II (Roadmap)</h3>
                  <p className={pClass}>
                    We are working toward SOC 2 Type II certification. Our infrastructure
                    provider (Supabase/AWS) already holds SOC 2 Type II certification —
                    details available at{' '}
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

            <section id="infrastructure" className={proseSectionClass}>
              <h2 className={h2Class}>Infrastructure &amp; Hosting</h2>

              <div className="space-y-6">
                <div>
                  <h3 className={h3Class}>Cloud Infrastructure</h3>
                  <p className={pClass}>
                    {appConfig.name} is hosted on Supabase, which runs on Amazon Web Services
                    (AWS). AWS maintains ISO 27001, SOC 1, SOC 2, and SOC 3 certifications.
                    Supabase itself holds SOC 2 Type II certification.
                  </p>
                </div>

                <div>
                  <h3 className={h3Class}>Physical Access Control</h3>
                  <p className={pClass}>
                    {appConfig.name} has no physical servers. All infrastructure is managed
                    by Supabase/AWS, which operate enterprise-grade data centres with strict
                    physical access controls.
                  </p>
                </div>

                <div>
                  <h3 className={h3Class}>Access Control</h3>
                  <p className={pClass}>
                    Access to {appConfig.name}&apos;s production database and infrastructure
                    is restricted to authorised team members only. All access requires strong
                    authentication. Database administration access is audited.
                  </p>
                </div>

                <div>
                  <h3 className={h3Class}>Row-Level Security</h3>
                  <p className={pClass}>
                    All data tables in {appConfig.name} enforce Row-Level Security (RLS)
                    policies at the database level. This means every query is scoped to the
                    authenticated user&apos;s workspace — it is architecturally impossible for
                    one customer&apos;s data to be accessed by another.
                  </p>
                </div>

                <div>
                  <h3 className={h3Class}>Penetration Testing</h3>
                  <p className={pClass}>
                    We plan to conduct annual third-party penetration testing as we approach
                    general availability. Customers with specific security assessment
                    requirements should contact us at{' '}
                    <TrustEmail href="mailto:security@ozer.so">security@ozer.so</TrustEmail>.
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
                    All data sent to and from {appConfig.name} is encrypted in transit using
                    HTTPS with TLS 1.2 or above. All {appConfig.name} services reject
                    connections using older TLS versions or insecure cipher suites.
                  </p>
                </div>

                <div>
                  <h3 className={h3Class}>Data at Rest</h3>
                  <p className={pClass}>
                    All data stored in {appConfig.name} is encrypted at rest using AES-256
                    encryption, managed by Supabase/AWS.
                  </p>
                </div>

                <div>
                  <h3 className={h3Class}>Data Residency</h3>
                  <p className={pClass}>
                    {appConfig.name} data is currently stored in the AWS EU West (Ireland)
                    region. We do not transfer customer data outside of the EU/EEA without
                    appropriate safeguards.
                  </p>
                </div>

                <div>
                  <h3 className={h3Class}>Backups</h3>
                  <p className={pClass}>
                    Supabase maintains automated daily database backups with point-in-time
                    recovery. Backups are stored in encrypted form across multiple
                    availability zones.
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
                    {appConfig.name} uses Supabase Auth for user authentication. Passwords are
                    never stored in plain text. We support:
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
                    All {appConfig.name} API routes are authenticated. API keys are scoped
                    and revocable. Rate limiting is applied to all public-facing endpoints.
                  </p>
                </div>

                <div>
                  <h3 className={h3Class}>Secure Development</h3>
                  <p className={pClass}>
                    All code changes to {appConfig.name} go through version control on
                    GitHub, peer review, and automated testing before deployment. We follow
                    OWASP secure development guidelines.
                  </p>
                </div>

                <div>
                  <h3 className={h3Class}>Dependency Management</h3>
                  <p className={pClass}>
                    We regularly audit our dependencies for known vulnerabilities using
                    automated tooling. Critical vulnerabilities are patched on a priority
                    basis.
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
                    {appConfig.name} is deployed on infrastructure designed for high
                    availability. Supabase/AWS provides automatic failover across multiple
                    availability zones.
                  </p>
                </div>

                <div>
                  <h3 className={h3Class}>Disaster Recovery</h3>
                  <p className={pClass}>
                    We maintain documented procedures for disaster recovery. In the event of
                    a significant incident, we can restore service from automated backups.
                  </p>
                </div>

                <div>
                  <h3 className={h3Class}>Incident Response</h3>
                  <p className={pClass}>
                    {appConfig.name} has a documented Security Incident Response process. In
                    the event of a security incident affecting customer data confidentiality,
                    we will notify affected customers without undue delay and in compliance
                    with our GDPR obligations (within 72 hours of becoming aware).
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

            <section id="vulnerability-disclosure" className={proseSectionClass}>
              <h2 className={h2Class}>Vulnerability Disclosure</h2>

              <div className="space-y-6">
                <div>
                  <h3 className={h3Class}>Reporting a Vulnerability</h3>
                  <p className={pClass}>
                    We take security disclosures seriously. If you discover a vulnerability
                    in {appConfig.name}, please report it to us at{' '}
                    <TrustEmail href="mailto:security@ozer.so">security@ozer.so</TrustEmail>.
                  </p>
                  <p className={`${pClass} mt-3`}>We ask that you:</p>
                  <ul className="text-muted-foreground mt-3 list-disc space-y-1.5 pl-5 text-sm leading-relaxed">
                    <li>
                      Do not publicly disclose the vulnerability before we&apos;ve had a
                      chance to investigate and fix it
                    </li>
                    <li>Provide enough detail for us to reproduce the issue</li>
                    <li>
                      Act in good faith and avoid accessing or modifying other users&apos;
                      data
                    </li>
                  </ul>
                  <p className={`${pClass} mt-3`}>
                    We will acknowledge your report within 2 business days, and will keep you
                    updated as we investigate and resolve the issue.
                  </p>
                </div>
              </div>
            </section>

            <section id="contact" className={proseSectionClass}>
              <h2 className={h2Class}>Contact</h2>
              <div className="space-y-4">
                <p className={pClass}>
                  For any security or privacy questions, contact us at{' '}
                  <TrustEmail href="mailto:security@ozer.so">security@ozer.so</TrustEmail>.
                </p>
                <p className={pClass}>
                  For DPA requests or GDPR queries, contact{' '}
                  <TrustEmail href="mailto:privacy@ozer.so">privacy@ozer.so</TrustEmail>.
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
