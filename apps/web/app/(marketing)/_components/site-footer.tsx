import type { ReactNode } from 'react';

import Link from 'next/link';

import { Trans } from '@kit/ui/trans';
import { cn } from '@kit/ui/utils';

import { AppLogo } from '~/components/app-logo';
import appConfig from '~/config/app.config';
import { docsUrl } from '~/lib/docs-url';
import { OZER_ASSISTANT_DOWNLOAD } from '~/lib/marketing/assistant-download';
import { marketingRule } from '~/lib/marketing/marketing-ui';

import { MarketingFooterNewsletter } from './marketing-footer-newsletter';

type FooterLink = { href: string; label: ReactNode; external?: boolean };

const SECTIONS: Array<{ heading: ReactNode; links: FooterLink[] }> = [
  {
    heading: 'Workspaces',
    links: [
      { href: '/commercial-property', label: 'Commercial property' },
      { href: '/work', label: 'Business' },
      { href: '/personal', label: 'Personal & family' },
      { href: '/work#coming-soon', label: 'Surveyors (Coming soon)' },
    ],
  },
  {
    heading: <Trans i18nKey="marketing:product" />,
    links: [
      { href: '/features', label: 'Features' },
      { href: OZER_ASSISTANT_DOWNLOAD.pagePath, label: 'Assistant for Mac' },
      { href: '/apps', label: 'Apps' },
      { href: '/pricing', label: <Trans i18nKey="marketing:pricing" /> },
      { href: docsUrl(), label: <Trans i18nKey="marketing:documentation" /> },
    ],
  },
  {
    heading: 'Company',
    links: [
      { href: '/blog', label: 'Blog' },
      { href: '/faq', label: 'FAQ' },
      { href: '/trust', label: 'Security' },
      { href: '/contact', label: <Trans i18nKey="marketing:contact" /> },
    ],
  },
  {
    heading: 'Compare',
    links: [
      { href: '/compare', label: 'All comparisons' },
      { href: '/compare/hellobonsai', label: 'Hello Bonsai' },
      { href: '/compare/honeybook', label: 'HoneyBook' },
      { href: '/compare/withmoxie', label: 'Moxie' },
    ],
  },
];

const SOCIAL_LINKS: FooterLink[] = [
  {
    href: 'https://www.linkedin.com/company/ozer-so',
    label: 'LinkedIn',
    external: true,
  },
  { href: 'https://x.com/ozerso', label: 'X', external: true },
  { href: 'mailto:hello@ozer.so', label: 'hello@ozer.so' },
];

const LEGAL_LINKS: FooterLink[] = [
  { href: '/privacy-policy', label: 'Privacy' },
  { href: '/terms-of-service', label: 'Terms' },
  { href: '/cookie-policy', label: 'Cookies' },
  { href: '/data-deletion', label: 'Data deletion' },
];

const linkClass =
  'rounded-[2px] text-[var(--workspace-shell-text-muted)] underline-offset-4 transition-colors duration-200 hover:text-[var(--workspace-shell-text)] hover:underline focus-visible:ring-2 focus-visible:ring-[var(--ozer-accent)] focus-visible:outline-none';

function FooterAnchor({ link }: { link: FooterLink }) {
  if (link.external) {
    return (
      <a
        href={link.href}
        target="_blank"
        rel="noopener noreferrer"
        className={linkClass}
      >
        {link.label}
      </a>
    );
  }

  return (
    <Link href={link.href} className={linkClass}>
      {link.label}
    </Link>
  );
}

export function SiteFooter() {
  return (
    <footer
      className={cn(
        marketingRule,
        'site-footer relative mt-auto w-full border-t bg-[var(--ozer-cream-100)] dark:bg-[var(--ozer-plum-950)]',
      )}
    >
      <div className="mx-auto w-full max-w-[88rem] px-6 pt-12 pb-10 md:pt-16">
        <p className="max-w-2xl text-sm leading-relaxed text-[var(--workspace-shell-text-muted)] md:text-base">
          Ozer is a workspace for UK commercial property agents. Published
          pricing, data hosted in the EU.
        </p>

        <div
          className={cn(
            marketingRule,
            'mt-10 grid gap-12 border-t pt-10 lg:grid-cols-12 lg:gap-10',
          )}
        >
          <div className="flex flex-col gap-6 lg:col-span-4">
            <AppLogo className="w-[85px] md:w-[95px]" />
            <p className="max-w-sm text-sm leading-relaxed text-[var(--workspace-shell-text-muted)]">
              Disposals, applicant matching, pipeline and portal feeds on one
              desk.
            </p>
            <MarketingFooterNewsletter className="max-w-sm" />
          </div>

          <nav
            aria-label="Footer"
            className="grid grid-cols-2 gap-x-8 gap-y-10 sm:grid-cols-4 lg:col-span-8"
          >
            {SECTIONS.map((section, index) => (
              <div key={index}>
                <p className="text-[0.8125rem] font-medium text-[var(--workspace-shell-text)]">
                  {section.heading}
                </p>
                <ul
                  className={cn(
                    marketingRule,
                    'mt-3 flex flex-col gap-y-2.5 border-t pt-3 text-sm',
                  )}
                >
                  {section.links.map((link) => (
                    <li key={link.href}>
                      <FooterAnchor link={link} />
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>
        </div>

        <div
          className={cn(
            marketingRule,
            'mt-16 flex flex-col gap-4 border-t pt-6 text-xs sm:flex-row sm:items-center sm:justify-between',
          )}
        >
          <p className="text-[var(--workspace-shell-text-muted)]">
            <Trans
              i18nKey="marketing:copyright"
              values={{
                product: appConfig.name,
                year: new Date().getFullYear(),
              }}
            />
          </p>
          <ul className="flex flex-wrap gap-x-5 gap-y-2">
            {[...SOCIAL_LINKS, ...LEGAL_LINKS].map((link) => (
              <li key={link.href}>
                <FooterAnchor link={link} />
              </li>
            ))}
          </ul>
        </div>
      </div>
    </footer>
  );
}
