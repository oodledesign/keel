import Link from 'next/link';

import { ArrowRight } from 'lucide-react';

import { Button } from '@kit/ui/button';
import { Trans } from '@kit/ui/trans';

import { MarketingFaqsSection } from '~/(marketing)/_components/marketing-faqs';
import { SitePageHeader } from '~/(marketing)/_components/site-page-header';
import { createI18nServerInstance } from '~/lib/i18n/i18n.server';
import { withI18n } from '~/lib/i18n/with-i18n';
import { OZER_FAQS } from '~/lib/marketing/ozer-faqs';
import { buildMarketingMetadata } from '~/lib/seo/marketing-metadata';
import { JsonLd } from '~/lib/seo/json-ld';
import { breadcrumbJsonLd, faqPageJsonLd, schemaGraph } from '~/lib/seo/schema';

export const generateMetadata = async () => {
  return buildMarketingMetadata({
    title: 'FAQ on pricing and seats — Ozer',
    description:
      'Answers on free plans, flat team pricing, trials, £ billing, EU data, and Mac meeting audio in the Ozer Workspace OS.',
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

      <div className="marketing-shell flex flex-col space-y-4 xl:space-y-8">
        <SitePageHeader
          title={t('marketing:faq')}
          subtitle="Straight answers on pricing, seats, data, and how Ozer works."
        />

        <MarketingFaqsSection
          faqs={OZER_FAQS}
          tone="light"
          className="pb-8"
          sectionClassName="py-0"
        />

        <div className="container flex justify-center pb-16">
          <Button asChild variant={'outline'}>
            <Link href={'/contact'}>
              <span>
                <Trans i18nKey={'marketing:contactFaq'} />
              </span>
              <ArrowRight className="ml-2 h-4" />
            </Link>
          </Button>
        </div>
      </div>
    </>
  );
}

export default withI18n(FAQPage);
