import { COMMERCIAL_GRADUATED_TIERS } from '~/lib/billing/commercial-graduated-pricing';
import { withI18n } from '~/lib/i18n/with-i18n';
import {
  COMMERCIAL_HOME_SEO,
  getCommercialHomeFaqs,
} from '~/lib/marketing/commercial-home-content';
import { loadMarketingViewer } from '~/lib/marketing/load-marketing-viewer';
import { JsonLd } from '~/lib/seo/json-ld';
import { buildMarketingMetadata } from '~/lib/seo/marketing-metadata';
import {
  absoluteUrl,
  faqPageJsonLd,
  schemaGraph,
  softwareApplicationJsonLd,
} from '~/lib/seo/schema';

import { CommercialFinalCta } from './_components/home/commercial-final-cta';
import { CommercialHomeHero } from './_components/home/commercial-home-hero';
import { CommercialPricingTeaser } from './_components/home/commercial-pricing-teaser';
import { CommercialSixJobsSection } from './_components/home/commercial-six-jobs-section';
import { CommercialTrustStrip } from './_components/home/commercial-trust-strip';
import { PainFixSection } from './_components/home/pain-fix-section';
import { MarketingFaqsSection } from './_components/marketing-faqs';

export const metadata = buildMarketingMetadata({
  title: COMMERCIAL_HOME_SEO.title,
  description: COMMERCIAL_HOME_SEO.description,
  path: '/',
  ogType: 'default',
  keywords: [...COMMERCIAL_HOME_SEO.keywords],
});

async function Home() {
  const viewer = await loadMarketingViewer();
  const faqs = getCommercialHomeFaqs();

  const offers = COMMERCIAL_GRADUATED_TIERS.map((tier) => ({
    name: tier.bandLabel,
    price: tier.unitGbp,
    description: `Commercial Property per-seat monthly price for ${tier.bandLabel}`,
    url: absoluteUrl('/#pricing'),
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
    <main className="relative">
      <JsonLd data={schema} />

      {/* 1. Hero (Cassis, dark) */}
      <CommercialHomeHero viewer={viewer} />

      {/* 2. Before and after (cream background, one coloured column) */}
      <PainFixSection />

      {/* 3. Six jobs you stop doing by hand (interactive tabs with color-blocking per panel) */}
      <CommercialSixJobsSection />

      {/* 4. Pricing (cream) */}
      <CommercialPricingTeaser />

      {/* 5. Trust strip (small, on cream, three items in a row) */}
      <CommercialTrustStrip />

      {/* 6. FAQ (cream, accordion with exactly 6 questions) */}
      <MarketingFaqsSection
        faqs={faqs}
        title="Questions agents ask us"
        headingId="home-faq-heading"
      />

      {/* 7. Final CTA (Orange Topaze, full-bleed) */}
      <CommercialFinalCta viewer={viewer} />
    </main>
  );
}

export default withI18n(Home);
