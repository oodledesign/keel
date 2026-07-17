import { SitePageHeader } from '~/(marketing)/_components/site-page-header';
import { createI18nServerInstance } from '~/lib/i18n/i18n.server';
import { withI18n } from '~/lib/i18n/with-i18n';
import { JsonLd } from '~/lib/seo/json-ld';
import { buildMarketingMetadata } from '~/lib/seo/marketing-metadata';
import { breadcrumbJsonLd, schemaGraph, webPageJsonLd } from '~/lib/seo/schema';

import { CookiePolicyContent } from '../_components/legal-content';

export async function generateMetadata() {
  return buildMarketingMetadata({
    title: 'Cookie policy — Ozer',
    description:
      'How Ozer uses essential, analytics, and preference cookies on ozer.so and how you can control them.',
    path: '/cookie-policy',
    ogType: 'legal',
  });
}

async function CookiePolicyPage() {
  const { t } = await createI18nServerInstance();

  return (
    <div>
      <JsonLd
        data={schemaGraph([
          webPageJsonLd({
            name: 'Cookie policy — Ozer',
            description: 'How Ozer uses cookies on ozer.so.',
            path: '/cookie-policy',
          }),
          breadcrumbJsonLd([
            { name: 'Home', path: '/' },
            { name: 'Cookie policy', path: '/cookie-policy' },
          ]),
        ])}
      />
      <SitePageHeader
        title={t(`marketing:cookiePolicy`)}
        subtitle={t(`marketing:cookiePolicyDescription`)}
      />

      <div className="container mx-auto px-4 py-8">
        <CookiePolicyContent />
      </div>
    </div>
  );
}

export default withI18n(CookiePolicyPage);
