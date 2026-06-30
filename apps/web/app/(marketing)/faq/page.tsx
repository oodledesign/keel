import Link from 'next/link';

import { ArrowRight } from 'lucide-react';

import { Button } from '@kit/ui/button';
import { Trans } from '@kit/ui/trans';

import { MarketingFaqsSection } from '~/(marketing)/_components/marketing-faqs';
import { SitePageHeader } from '~/(marketing)/_components/site-page-header';
import { createI18nServerInstance } from '~/lib/i18n/i18n.server';
import { withI18n } from '~/lib/i18n/with-i18n';

export const generateMetadata = async () => {
  const { t } = await createI18nServerInstance();

  return {
    title: t('marketing:faq'),
  };
};

async function FAQPage() {
  const { t } = await createI18nServerInstance();

  const faqItems = [
    {
      question: `Do you offer a free trial?`,
      answer: `Yes, we offer a 14-day free trial. You can cancel at any time during the trial period and you won't be charged.`,
    },
    {
      question: `Can I cancel my subscription?`,
      answer: `You can cancel your subscription at any time. You can do this from your account settings.`,
    },
    {
      question: `Where can I find my invoices?`,
      answer: `You can find your invoices in your account settings.`,
    },
    {
      question: `What payment methods do you accept?`,
      answer: `We accept all major credit cards and PayPal.`,
    },
    {
      question: `Can I upgrade or downgrade my plan?`,
      answer: `Yes, you can upgrade or downgrade your plan at any time. You can do this from your account settings.`,
    },
    {
      question: `Do you offer discounts for non-profits?`,
      answer: `Yes, we offer a 50% discount for non-profits. Please contact us to learn more.`,
    },
  ];

  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqItems.map((item) => {
      return {
        '@type': 'Question',
        name: item.question,
        acceptedAnswer: {
          '@type': 'Answer',
          text: item.answer,
        },
      };
    }),
  };

  return (
    <>
      <script
        key={'ld:json'}
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />

      <div className="marketing-shell flex flex-col space-y-4 xl:space-y-8">
        <SitePageHeader
          title={t('marketing:faq')}
          subtitle={t('marketing:faqSubtitle')}
        />

        <MarketingFaqsSection
          faqs={faqItems}
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
              <ArrowRight className={'ml-2 w-4'} />
            </Link>
          </Button>
        </div>
      </div>
    </>
  );
}

export default withI18n(FAQPage);
