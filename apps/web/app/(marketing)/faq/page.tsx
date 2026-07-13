import Link from 'next/link';

import { ArrowRight } from 'lucide-react';

import { Button } from '@kit/ui/button';
import { Trans } from '@kit/ui/trans';

import { MarketingFaqsSection } from '~/(marketing)/_components/marketing-faqs';
import { SitePageHeader } from '~/(marketing)/_components/site-page-header';
import { createI18nServerInstance } from '~/lib/i18n/i18n.server';
import { withI18n } from '~/lib/i18n/with-i18n';
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

  const faqItems = [
    {
      question: `Is there a free plan?`,
      answer: `Yes. Personal home and one family workspace are free with no card and no time limit. Business Lite is also free if you mainly need apps. Paid workspaces include a 14-day trial on your first paid plan — no credit card required to start.`,
    },
    {
      question: `Do I pay per seat?`,
      answer: `No. One workspace price covers the team. Invited members do not pay — billing stays with the workspace owner.`,
    },
    {
      question: `Can I cancel anytime?`,
      answer: `Yes. Cancel from account settings. You keep access through the period you have already paid for.`,
    },
    {
      question: `Where do I find invoices?`,
      answer: `In account settings under billing. Paid plans are billed in £ via Stripe.`,
    },
    {
      question: `What payment methods do you accept?`,
      answer: `Major cards through Stripe. Bank details can also appear on client invoices you send from Ozer.`,
    },
    {
      question: `Where is my data hosted?`,
      answer: `Ozer is built for EU data residency. Meeting audio on Mac is processed on your machine and is not kept as a permanent recording.`,
    },
    {
      question: `Do you offer non-profit pricing?`,
      answer: `Yes — 50% off for eligible non-profits. Contact us and we will set it up.`,
    },
  ];

  return (
    <>
      <JsonLd
        data={schemaGraph([
          faqPageJsonLd(faqItems),
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
              <ArrowRight className="ml-2 h-4" />
            </Link>
          </Button>
        </div>
      </div>
    </>
  );
}

export default withI18n(FAQPage);
