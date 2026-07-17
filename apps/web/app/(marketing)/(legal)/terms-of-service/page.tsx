import { SitePageHeader } from '~/(marketing)/_components/site-page-header';
import { createI18nServerInstance } from '~/lib/i18n/i18n.server';
import { withI18n } from '~/lib/i18n/with-i18n';
import { JsonLd } from '~/lib/seo/json-ld';
import { buildMarketingMetadata } from '~/lib/seo/marketing-metadata';
import { breadcrumbJsonLd, schemaGraph, webPageJsonLd } from '~/lib/seo/schema';

import { TermsOfServiceContent } from '../_components/legal-content';

export async function generateMetadata() {
  return buildMarketingMetadata({
    title: 'Terms of service — Ozer',
    description:
      'Terms for using Ozer, operated by Oodle Designs Ltd, including subscriptions, AI features, and liability under English law.',
    path: '/terms-of-service',
    ogType: 'legal',
  });
}

async function TermsOfServicePage() {
  const { t } = await createI18nServerInstance();

  return (
    <div>
      <JsonLd
        data={schemaGraph([
          webPageJsonLd({
            name: 'Terms of service — Ozer',
            description: 'Terms for using Ozer, operated by Oodle Designs Ltd.',
            path: '/terms-of-service',
          }),
          breadcrumbJsonLd([
            { name: 'Home', path: '/' },
            { name: 'Terms of service', path: '/terms-of-service' },
          ]),
        ])}
      />
      <SitePageHeader
        title={t(`marketing:termsOfService`)}
        subtitle={t(`marketing:termsOfServiceDescription`)}
      />

      <div className="container mx-auto px-4 py-8">
        <TermsOfServiceContent />
      </div>
    </div>
  );
}

export default withI18n(TermsOfServicePage);
