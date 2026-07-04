import { Heading } from '@kit/ui/heading';
import { Trans } from '@kit/ui/trans';

import { SitePageHeader } from '~/(marketing)/_components/site-page-header';
import { ContactForm } from '~/(marketing)/contact/_components/contact-form';
import { createI18nServerInstance } from '~/lib/i18n/i18n.server';
import { withI18n } from '~/lib/i18n/with-i18n';
import { buildMarketingMetadata } from '~/lib/seo/marketing-metadata';
import { JsonLd } from '~/lib/seo/json-ld';
import { breadcrumbJsonLd, schemaGraph, webPageJsonLd } from '~/lib/seo/schema';

export async function generateMetadata() {
  return buildMarketingMetadata({
    title: 'Contact the Ozer team — Ozer',
    description:
      'Contact Ozer for product questions, non-profit pricing, or support. We reply from the UK studio.',
    path: '/contact',
    ogType: 'default',
  });
}

async function ContactPage() {
  const { t } = await createI18nServerInstance();

  return (
    <div>
      <JsonLd
        data={schemaGraph([
          webPageJsonLd({
            name: 'Contact the Ozer team — Ozer',
            description: 'Contact Ozer for product questions or support.',
            path: '/contact',
          }),
          breadcrumbJsonLd([
            { name: 'Home', path: '/' },
            { name: 'Contact', path: '/contact' },
          ]),
        ])}
      />
      <SitePageHeader
        title={t(`marketing:contact`)}
        subtitle={t(`marketing:contactDescription`)}
      />

      <div className={'container mx-auto'}>
        <div
          className={'flex flex-1 flex-col items-center justify-center py-8'}
        >
          <div
            className={
              'flex w-full max-w-lg flex-col space-y-4 rounded-lg border p-8'
            }
          >
            <div>
              <Heading level={3}>
                <Trans i18nKey={'marketing:contactHeading'} />
              </Heading>

              <div className={'text-muted-foreground'}>
                <Trans i18nKey={'marketing:contactSubheading'} />
              </div>
            </div>

            <ContactForm />
          </div>
        </div>
      </div>
    </div>
  );
}

export default withI18n(ContactPage);
