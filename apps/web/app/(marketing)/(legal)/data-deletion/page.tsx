import { SitePageHeader } from '~/(marketing)/_components/site-page-header';
import { createI18nServerInstance } from '~/lib/i18n/i18n.server';
import { withI18n } from '~/lib/i18n/with-i18n';
import { JsonLd } from '~/lib/seo/json-ld';
import { buildMarketingMetadata } from '~/lib/seo/marketing-metadata';
import { breadcrumbJsonLd, schemaGraph, webPageJsonLd } from '~/lib/seo/schema';

import { DataDeletionContent } from '../_components/legal-content';

export async function generateMetadata() {
  return buildMarketingMetadata({
    title: 'Data deletion — Ozer',
    description:
      'How to delete your Ozer account, disconnect Instagram and other social accounts, and how Meta data-deletion requests are handled.',
    path: '/data-deletion',
    ogType: 'legal',
  });
}

async function DataDeletionPage() {
  const { t } = await createI18nServerInstance();

  return (
    <div>
      <JsonLd
        data={schemaGraph([
          webPageJsonLd({
            name: 'Data deletion — Ozer',
            description:
              'How to delete your Ozer account and Instagram connections.',
            path: '/data-deletion',
          }),
          breadcrumbJsonLd([
            { name: 'Home', path: '/' },
            { name: 'Data deletion', path: '/data-deletion' },
          ]),
        ])}
      />
      <SitePageHeader
        title={t('marketing:dataDeletion')}
        subtitle={t('marketing:dataDeletionDescription')}
      />

      <div className="container mx-auto px-4 py-8">
        <DataDeletionContent />
      </div>
    </div>
  );
}

export default withI18n(DataDeletionPage);
