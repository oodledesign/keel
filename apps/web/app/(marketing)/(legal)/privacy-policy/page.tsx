import { SitePageHeader } from '~/(marketing)/_components/site-page-header';
import { createI18nServerInstance } from '~/lib/i18n/i18n.server';
import { withI18n } from '~/lib/i18n/with-i18n';
import { JsonLd } from '~/lib/seo/json-ld';
import { buildMarketingMetadata } from '~/lib/seo/marketing-metadata';
import { breadcrumbJsonLd, schemaGraph, webPageJsonLd } from '~/lib/seo/schema';

import { PrivacyPolicyContent } from '../_components/legal-content';

export async function generateMetadata() {
  return buildMarketingMetadata({
    title: 'Privacy policy — Ozer',
    description:
      'How Oodle Designs Ltd processes personal data for Ozer under UK GDPR, including AI features, Stripe payments, and EU transfers.',
    path: '/privacy-policy',
    ogType: 'legal',
  });
}

async function PrivacyPolicyPage() {
  const { t } = await createI18nServerInstance();

  return (
    <div>
      <JsonLd
        data={schemaGraph([
          webPageJsonLd({
            name: 'Privacy policy — Ozer',
            description: 'How Ozer processes personal data under UK GDPR.',
            path: '/privacy-policy',
          }),
          breadcrumbJsonLd([
            { name: 'Home', path: '/' },
            { name: 'Privacy policy', path: '/privacy-policy' },
          ]),
        ])}
      />
      <SitePageHeader
        title={t('marketing:privacyPolicy')}
        subtitle={t('marketing:privacyPolicyDescription')}
      />

      <div className="container mx-auto px-4 py-8">
        <PrivacyPolicyContent />
      </div>
    </div>
  );
}

export default withI18n(PrivacyPolicyPage);
