// Task A: Life CRM → OS copy (footer description).
import type { ReactNode } from 'react';

import { Footer } from '@kit/ui/marketing';
import { Trans } from '@kit/ui/trans';

import { AppLogo } from '~/components/app-logo';
import appConfig from '~/config/app.config';

import { MarketingFooterNewsletter } from './marketing-footer-newsletter';

function SocialIcon({ children }: { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className="size-4"
      fill="currentColor"
      aria-hidden
    >
      {children}
    </svg>
  );
}

export function SiteFooter() {
  return (
    <Footer
      logo={<AppLogo className="w-[85px] md:w-[95px]" />}
      description={
        <p>
          Ozer is the Workspace OS for freelancers and small agencies — your
          studio, your life, one home. Flat pricing, data in the EU.
        </p>
      }
      copyright={
        <Trans
          i18nKey="marketing:copyright"
          values={{
            product: appConfig.name,
            year: new Date().getFullYear(),
          }}
        />
      }
      socialLinks={[
        {
          href: 'https://www.linkedin.com/company/ozer-so',
          label: 'LinkedIn',
          icon: (
            <SocialIcon>
              <path d="M4.98 3.5C4.98 4.88 3.86 6 2.5 6S0 4.88 0 3.5 1.12 1 2.5 1s2.48 1.12 2.48 2.5zM.5 8.5h4V23h-4V8.5zM8.5 8.5h3.8v2h.05c.53-1 1.82-2.05 3.75-2.05 4.01 0 4.75 2.64 4.75 6.07V23h-4v-6.6c0-1.57-.03-3.59-2.19-3.59-2.19 0-2.53 1.71-2.53 3.48V23h-4V8.5z" />
            </SocialIcon>
          ),
        },
        {
          href: 'https://x.com/ozerso',
          label: 'X',
          icon: (
            <SocialIcon>
              <path d="M18.244 2H21.5l-7.5 8.57L22.5 22h-6.57l-5.14-6.7L5.2 22H1.94l8.03-9.17L1.5 2h6.74l4.65 6.14L18.244 2zm-1.15 18h1.8L7.02 3.94H5.1L17.094 20z" />
            </SocialIcon>
          ),
        },
        {
          href: 'mailto:hello@ozer.so',
          label: 'Email',
          icon: (
            <SocialIcon>
              <path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4-8 5L4 8V6l8 5 8-5v2z" />
            </SocialIcon>
          ),
        },
      ]}
      sections={[
        {
          heading: 'Company',
          links: [
            { href: '/personal', label: 'Personal & family' },
            { href: '/work', label: 'Business' },
            { href: '/blog', label: 'Blog' },
            { href: '/contact', label: <Trans i18nKey="marketing:contact" /> },
            { href: '/#coming-soon', label: 'Coming soon' },
          ],
        },
        {
          heading: <Trans i18nKey="marketing:product" />,
          links: [
            { href: '/features', label: 'Features' },
            { href: '/features/activity', label: 'Activity tracking' },
            { href: '/features/desktop-assistant', label: 'Assistant for Mac' },
            { href: '/apps', label: 'Apps' },
            { href: '/pricing', label: <Trans i18nKey="marketing:pricing" /> },
            { href: '/faq', label: 'FAQ' },
          ],
        },
        {
          heading: 'Compare',
          links: [
            { href: '/compare', label: 'All comparisons' },
            {
              href: '/compare/hellobonsai',
              label: 'Hello Bonsai alternatives',
            },
            { href: '/compare/honeybook', label: 'HoneyBook alternatives' },
            { href: '/compare/withmoxie', label: 'Moxie alternatives' },
          ],
        },
      ]}
      newsletter={<MarketingFooterNewsletter />}
      legalLinks={[
        { href: '/privacy-policy', label: 'Privacy Policy' },
        { href: '/terms-of-service', label: 'Terms of Service' },
        { href: '/trust', label: 'Security' },
        { href: '/cookie-policy', label: 'Cookie' },
      ]}
    />
  );
}
