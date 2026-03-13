import { Footer } from '@kit/ui/marketing';
import { Trans } from '@kit/ui/trans';

import { AppLogo } from '~/components/app-logo';
import appConfig from '~/config/app.config';

export function SiteFooter() {
  return (
    <Footer
      logo={<AppLogo className="w-[85px] md:w-[95px]" />}
      description={
        <>
          <p>Simple, accessible business management for tradespeople who value clarity and peace of mind.</p>
        </>
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
          heading: <Trans i18nKey="marketing:product" />,
          links: [
            { href: '/#built-for', label: <Trans i18nKey="marketing:features" /> },
            { href: '/#pricing', label: <Trans i18nKey="marketing:pricing" /> },
            { href: '/#integrations', label: <Trans i18nKey="marketing:integrations" /> },
            { href: '/#testimonials', label: <Trans i18nKey="marketing:testimonials" /> },
          ],
        },
        // Company & Legal sections hidden while other marketing pages are disabled
        // { heading: 'Company', links: [...], },
        // { heading: <Trans i18nKey="marketing:legal" />, links: [...], },
      ]}
    />
  );
}
