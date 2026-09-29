import Link from 'next/link';

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
  marketingBtnGradient,
  marketingBtnOutline,
  marketingShellClass,
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
import { CommercialProofStrip } from './_components/home/commercial-proof-strip';
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
    description: `${tier.description} — ${tier.seatRangeLabel}`,
    url: absoluteUrl('/commercial-property#pricing'),
  }));

  const schema = schemaGraph([
    softwareApplicationJsonLd({
      name: 'Ozer',
      description:
        'The workspace for UK commercial property agents — disposals, requirements, matching, circulation, pipeline and portal publishing to Rightmove Commercial, EACH and Property Hive.',
      url: absoluteUrl('/'),
      offers,
    }),
    faqPageJsonLd(faqs),
  ]);

  return (
    <main className={cn('relative', marketingShellClass)}>
      <JsonLd data={schema} />

      <CommercialHomeHero viewer={viewer} />

      <CommercialProofStrip />

      <PainFixSection />

      <FeatureTourSection
        blocks={COMMERCIAL_FEATURE_TOUR_BLOCKS}
        eyebrow={COMMERCIAL_TOUR_HEADING.eyebrow}
        heading={COMMERCIAL_TOUR_HEADING.title}
        intro={COMMERCIAL_TOUR_HEADING.intro}
        cta={
          <>
            <Button asChild className={marketingBtnGradient}>
              <Link href="#waitlist">Join the waiting list</Link>
            </Button>
            <Button asChild variant="outline" className={marketingBtnOutline}>
              <Link href="/commercial-property">
                Explore the commercial workspace
              </Link>
            </Button>
          </>
        }
      />

      <CommercialPricingTeaser />

      <CommercialTrustStrip />

      <MarketingFaqsSection
        faqs={faqs}
        tone="light"
        title="Questions, answered"
        headingId="home-faq-heading"
      />

      <div className="mx-auto -mt-6 mb-4 flex w-full max-w-3xl justify-center px-6 md:-mt-8">
        <Button asChild variant="outline" className={marketingBtnOutline}>
          <Link href="/faq">View all FAQs</Link>
        </Button>
      </div>

      <WorkspacesStrip />

      <CommercialFinalCta viewer={viewer} />
    </main>
  );
}

export default withI18n(Home);
