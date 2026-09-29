import Link from 'next/link';

import { ArrowRight } from 'lucide-react';

import { Trans } from '@kit/ui/trans';

import { MarketingFaqsSection } from '~/(marketing)/_components/marketing-faqs';
import { SitePageHeader } from '~/(marketing)/_components/site-page-header';
import { createI18nServerInstance } from '~/lib/i18n/i18n.server';
import { withI18n } from '~/lib/i18n/with-i18n';
import { marketingTextLink } from '~/lib/marketing/marketing-ui';
import { OZER_FAQS } from '~/lib/marketing/ozer-faqs';
import { JsonLd } from '~/lib/seo/json-ld';
import { buildMarketingMetadata } from '~/lib/seo/marketing-metadata';
import { breadcrumbJsonLd, faqPageJsonLd, schemaGraph } from '~/lib/seo/schema';

export const generateMetadata = async () => {
  return buildMarketingMetadata({
    title: 'FAQ on pricing and seats | Ozer',
    description:
      'Answers on free plans, graduated Starter and Pro seats, trials, £ billing, EU data, and Mac meeting audio in the Ozer Workspace OS.',
    path: '/faq',
    ogType: 'default',
  });
};

async function FAQPage() {
  const { t } = await createI18nServerInstance();

  return (
    <>
      <JsonLd
        data={schemaGraph([
          faqPageJsonLd(OZER_FAQS),
          breadcrumbJsonLd([
            { name: 'Home', path: '/' },
            { name: 'FAQ', path: '/faq' },
          ]),
        ])}
      />

      <div className="marketing-shell flex flex-col">
        <SitePageHeader
          title={t('marketing:faq')}
          subtitle="Straight answers on pricing, seats, data, and how Ozer works."
        />

        <MarketingFaqsSection
          faqs={OZER_FAQS}
          tone="light"
          title="Pricing, seats and your data"
          sectionClassName="pt-16 pb-24 md:pt-20 md:pb-32"
          footer={
            <Link href={'/contact'} className={marketingTextLink}>
              <Trans i18nKey={'marketing:contactFaq'} />
              <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
          }
        />
      </div>
    </>
  );
}

export default withI18n(FAQPage);
