import { SitePageHeader } from '~/(marketing)/_components/site-page-header';
import { createI18nServerInstance } from '~/lib/i18n/i18n.server';
import { withI18n } from '~/lib/i18n/with-i18n';
import { JsonLd } from '~/lib/seo/json-ld';
import { buildMarketingMetadata } from '~/lib/seo/marketing-metadata';
import { breadcrumbJsonLd, schemaGraph, webPageJsonLd } from '~/lib/seo/schema';

import { DpaContent } from '../_components/legal-content';

export async function generateMetadata() {
  return buildMarketingMetadata({
    title: 'Data Processing Agreement — Ozer',
    description:
      'UK GDPR Article 28 Data Processing Agreement for Ozer (Oodle Designs Ltd), including sub-processors and dual controller/processor roles.',
    path: '/dpa',
    ogType: 'legal',
  });
}

async function DpaPage() {
  await createI18nServerInstance();

  return (
    <div>
      <JsonLd
        data={schemaGraph([
          webPageJsonLd({
            name: 'Data Processing Agreement — Ozer',
            description:
              'UK GDPR Article 28 Data Processing Agreement for Ozer.',
            path: '/dpa',
          }),
          breadcrumbJsonLd([
            { name: 'Home', path: '/' },
            { name: 'Data Processing Agreement', path: '/dpa' },
          ]),
        ])}
      />
      <SitePageHeader
        title="Data Processing Agreement"
        subtitle="UK GDPR Article 28 terms for customers who use Ozer as a processor. Draft pending solicitor review."
      />

      <div className="container mx-auto px-4 py-8">
        <DpaContent />
      </div>
    </div>
  );
}

export default withI18n(DpaPage);
