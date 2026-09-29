import Link from 'next/link';

import { ArrowRight } from 'lucide-react';

import { Button } from '@kit/ui/button';
import { cn } from '@kit/ui/utils';

import {
  COMMERCIAL_ILLUSTRATIVE_TIERS,
  estimateMonthlyGbp,
} from '~/lib/billing/commercial-graduated-pricing';
import { withI18n } from '~/lib/i18n/with-i18n';
import {
  COMMERCIAL_FEATURE_TOUR_BLOCKS,
  COMMERCIAL_HOME_FAQ_QUESTIONS,
  COMMERCIAL_HOME_SEO,
  COMMERCIAL_HOME_WAITLIST_FAQ,
  COMMERCIAL_TOUR_HEADING,
} from '~/lib/marketing/commercial-home-content';
import { loadMarketingViewer } from '~/lib/marketing/load-marketing-viewer';
import {
  marketingBtnPrimary,
  marketingShellClass,
  marketingTextLink,
} from '~/lib/marketing/marketing-ui';
import { getSegmentLandingConfig } from '~/lib/marketing/segment-landing-pages';
import { JsonLd } from '~/lib/seo/json-ld';
import { buildMarketingMetadata } from '~/lib/seo/marketing-metadata';
import {
  absoluteUrl,
  faqPageJsonLd,
  schemaGraph,
  softwareApplicationJsonLd,
} from '~/lib/seo/schema';

import { FeatureTourSection } from './_components/feature-tour-section';
import { CommercialFinalCta } from './_components/home/commercial-final-cta';
import { CommercialHomeHero } from './_components/home/commercial-home-hero';
import { CommercialPricingTeaser } from './_components/home/commercial-pricing-teaser';
import { CommercialProofQuote } from './_components/home/commercial-proof-quote';
import { CommercialTrustStrip } from './_components/home/commercial-trust-strip';
import { PainFixSection } from './_components/home/pain-fix-section';
import { WorkspacesStrip } from './_components/home/workspaces-strip';
import { MarketingFaqsSection } from './_components/marketing-faqs';

export const metadata = buildMarketingMetadata({
  title: COMMERCIAL_HOME_SEO.title,
  description: COMMERCIAL_HOME_SEO.description,
  path: '/',
  ogType: 'default',
  keywords: [...COMMERCIAL_HOME_SEO.keywords],
});

function getHomeFaqs() {
  const commercialFaqs = getSegmentLandingConfig('commercial-property')?.faqs;
  const selected = COMMERCIAL_HOME_FAQ_QUESTIONS.flatMap((question) => {
    const faq = commercialFaqs?.find((item) => item.question === question);

    return faq ? [faq] : [];
  });

  return [...selected, COMMERCIAL_HOME_WAITLIST_FAQ];
}

async function Home() {
  const viewer = await loadMarketingViewer();
  const faqs = getHomeFaqs();

  const offers = COMMERCIAL_ILLUSTRATIVE_TIERS.map((tier) => ({
    name: tier.label,
    price: estimateMonthlyGbp(tier.billableSeats),
    description: `${tier.description} (${tier.seatRangeLabel})`,
    url: absoluteUrl('/commercial-property#pricing'),
  }));

  const schema = schemaGraph([
    softwareApplicationJsonLd({
      name: 'Ozer',
      description:
        'The workspace for UK commercial property agents: disposals, requirements, matching, circulation, pipeline and portal publishing to Rightmove Commercial, EACH and Property Hive.',
      url: absoluteUrl('/'),
      offers,
    }),
    faqPageJsonLd(faqs),
  ]);

  return (
    <main className={cn('relative', marketingShellClass)}>
      <JsonLd data={schema} />

      <CommercialHomeHero viewer={viewer} />

      <CommercialProofQuote />

      <PainFixSection />

      <FeatureTourSection
        index="02"
        blocks={COMMERCIAL_FEATURE_TOUR_BLOCKS}
        eyebrow={COMMERCIAL_TOUR_HEADING.eyebrow}
        heading={COMMERCIAL_TOUR_HEADING.title}
        intro={COMMERCIAL_TOUR_HEADING.intro}
        cta={
          <>
            <Button asChild className={marketingBtnPrimary}>
              <Link href="#waitlist">
                Join the waiting list
                <ArrowRight className="size-4" aria-hidden="true" />
              </Link>
            </Button>
            <Link href="/commercial-property" className={marketingTextLink}>
              Explore the commercial workspace
            </Link>
          </>
        }
      />

      <CommercialPricingTeaser />

      <CommercialTrustStrip />

      <MarketingFaqsSection
        faqs={faqs}
        index="04"
        title="Questions agents ask us"
        headingId="home-faq-heading"
        footer={
          <Link href="/faq" className={marketingTextLink}>
            All FAQs
          </Link>
        }
      />

      <WorkspacesStrip />

      <CommercialFinalCta viewer={viewer} />
    </main>
  );
}

export default withI18n(Home);
