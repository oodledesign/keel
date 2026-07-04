// Task A: Life CRM → OS copy (footer description).
import { Footer } from '@kit/ui/marketing';
import { Trans } from '@kit/ui/trans';

import { AppLogo } from '~/components/app-logo';
import appConfig from '~/config/app.config';

export function SiteFooter() {
  return (
    <Footer
      logo={<AppLogo className="w-[85px] md:w-[95px]" />}
      description={
        <p>
          Ozer is the Workspace OS for freelancers and small agencies — personal,
          business, family, and community. One price covers the team. Data in the EU.
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
      sections={[
        {
          heading: 'Solutions',
          links: [
            { href: '/personal', label: 'Personal & family' },
            { href: '/work', label: 'Business' },
            { href: '/property', label: 'Property' },
            { href: '/community', label: 'Community' },
          ],
        },
        {
          heading: <Trans i18nKey="marketing:product" />,
          links: [
            { href: '/apps', label: 'Apps' },
            { href: '/pricing', label: <Trans i18nKey="marketing:pricing" /> },
            { href: '/faq', label: 'FAQ' },
            { href: '/contact', label: <Trans i18nKey="marketing:contact" /> },
            { href: '/blog', label: 'Blog' },
          ],
        },
        {
          heading: 'Compare',
          links: [
            { href: '/compare', label: 'All comparisons' },
            { href: '/compare/hellobonsai', label: 'Hello Bonsai alternatives' },
            { href: '/compare/honeybook', label: 'HoneyBook alternatives' },
            { href: '/compare/withmoxie', label: 'Moxie alternatives' },
            { href: '/compare/productive-io', label: 'Productive.io alternatives' },
          ],
        },
        {
          heading: 'Legal & Security',
          links: [
            { href: '/trust', label: 'Trust Centre' },
            { href: '/privacy-policy', label: 'Privacy policy' },
            { href: '/terms-of-service', label: 'Terms of service' },
            { href: '/cookie-policy', label: 'Cookie policy' },
          ],
        },
      ]}
    />
  );
}
