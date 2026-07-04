import { createI18nServerInstance } from '~/lib/i18n/i18n.server';
import { withI18n } from '~/lib/i18n/with-i18n';

import { SitePageHeader } from '../_components/site-page-header';
import { DocsCards } from './_components/docs-cards';
import { getDocs } from './_lib/server/docs.loader';

import { buildMarketingMetadata } from '~/lib/seo/marketing-metadata';

export const generateMetadata = async () => {
  return buildMarketingMetadata({
    title: 'Documentation — Ozer',
    description:
      'Tutorials and guides for configuring and using the Ozer Workspace OS.',
    path: '/docs',
    ogType: 'default',
  });
};

async function DocsPage() {
  const { t, resolvedLanguage } = await createI18nServerInstance();
  const items = await getDocs(resolvedLanguage);

  // Filter out any docs that have a parentId, as these are children of other docs
  const cards = items.filter((item) => !item.parentId);

  return (
    <div className={'flex w-full flex-1 flex-col gap-y-6 xl:gap-y-8'}>
      <SitePageHeader
        title={t('marketing:documentation')}
        subtitle={t('marketing:documentationSubtitle')}
      />

      <div className={'relative flex size-full justify-center overflow-y-auto'}>
        <DocsCards cards={cards} />
      </div>
    </div>
  );
}

export default withI18n(DocsPage);
