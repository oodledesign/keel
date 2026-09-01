import Link from 'next/link';

import { Button } from '@kit/ui/button';
import { cn } from '@kit/ui/utils';

import { formatGbp } from '~/lib/billing/billing-config-prices';
import { estimateMonthlyGbp } from '~/lib/billing/business-graduated-pricing';
import {
  MARKETING_FREE_SIGNUP_URL,
  MARKETING_FREE_TIER,
  MARKETING_WORKSPACE_PLANS,
} from '~/lib/billing/pricing-marketing';
import { withI18n } from '~/lib/i18n/with-i18n';
import { loadMarketingViewer } from '~/lib/marketing/load-marketing-viewer';
import {
  marketingBtnGradient,
  marketingBtnOutline,
  marketingFeatureCard,
  marketingShellClass,
} from '~/lib/marketing/marketing-ui';
import { HOME_FAQS } from '~/lib/marketing/ozer-faqs';
import { JsonLd } from '~/lib/seo/json-ld';
import { buildMarketingMetadata } from '~/lib/seo/marketing-metadata';
import {
  absoluteUrl,
  faqPageJsonLd,
  schemaGraph,
  softwareApplicationJsonLd,
} from '~/lib/seo/schema';

import { ComingSoon } from './_components/coming-soon';
import { FeatureTourSection } from './_components/feature-tour-section';
import { InterconnectedWorkspacesSection } from './_components/interconnected-workspaces-section';
import { MarketingFaqsSection } from './_components/marketing-faqs';
import { MarketingFinalCta } from './_components/marketing-final-cta';
import { MarketingHomeHero } from './_components/marketing-home-hero';
import { WorkspaceFeatureComparison } from './_components/workspace-feature-comparison';

export const metadata = buildMarketingMetadata({
  title: 'Workspace OS for studios — Ozer',
  description:
    'Ozer is the Workspace OS for freelancers and small studios. Clients, projects, invoices, pipeline, activity tracking, and your plan for the day in one place — from £14 on Starter or £29 on Pro.',
  path: '/',
  ogType: 'default',
  keywords: [
    'workspace OS',
    'freelance CRM UK',
    'agency software',
    'small business workspace',
  ],
});

async function Home() {
  const viewer = await loadMarketingViewer();

  const offers = [
    {
      name: MARKETING_FREE_TIER.name,
      price: 0,
      description: MARKETING_FREE_TIER.description,
      url: absoluteUrl('/pricing'),
    },
    ...MARKETING_WORKSPACE_PLANS.map((plan) => ({
      name: plan.name,
      price: plan.monthlyPriceGbp,
      description: plan.description,
      url: absoluteUrl('/pricing'),
    })),
  ];

  const schema = schemaGraph([
    softwareApplicationJsonLd({
      name: 'Ozer',
      description:
        'Workspace OS for freelancers and small studios — clients, projects, invoices, pipeline, activity tracking, and your plan for the day in one place.',
      url: absoluteUrl('/'),
      offers,
    }),
    faqPageJsonLd(HOME_FAQS),
  ]);

  return (
    <main className={cn('relative', marketingShellClass)}>
      <JsonLd data={schema} />

      {/* Tighter top padding so the connection map peeks above the fold */}
      <section className="relative mx-auto flex w-full max-w-7xl flex-col px-6 pt-14 pb-14 md:pt-20 md:pb-20">
        <MarketingHomeHero viewer={viewer} />
      </section>

      <InterconnectedWorkspacesSection tone="light" />

      <FeatureTourSection />

      <WorkspaceFeatureComparison variant="preview" />

      <section
        id="pricing"
        className="mx-auto w-full max-w-7xl px-6 py-16"
        aria-labelledby="home-pricing-heading"
      >
        <div
          className={cn(
            'rounded-[1.75rem] border border-[color:var(--workspace-shell-border)] p-8 text-center md:p-10',
            marketingFeatureCard,
          )}
        >
          <h2
            id="home-pricing-heading"
            className="font-heading text-3xl font-semibold text-[var(--workspace-shell-text)]"
          >
            Graduated from £14 Starter / £29 Pro
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-[var(--workspace-shell-text-muted)]">
            Starter is £14 for seat 1, then £9 each extra. Pro is{' '}
            {formatGbp(estimateMonthlyGbp(1))} for seat 1, then £22 each extra —
            a 4-seat studio is {formatGbp(estimateMonthlyGbp(4))}/month. No
            transaction fees on your subscription.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Button asChild className={marketingBtnGradient}>
              <Link href="/pricing">See pricing</Link>
            </Button>
            <Button asChild variant="outline" className={marketingBtnOutline}>
              <Link href="/pricing/explained">Ozer pricing, explained</Link>
            </Button>
          </div>
        </div>
      </section>

      <ComingSoon />

      <MarketingFaqsSection
        faqs={HOME_FAQS}
        tone="light"
        title="Questions, answered"
        headingId="home-faq-heading"
        sectionClassName="border-t border-[color:var(--workspace-shell-border)]"
      />

      <div className="mx-auto -mt-6 mb-10 flex w-full max-w-3xl justify-center px-6 md:-mt-8 md:mb-12">
        <Button asChild variant="outline" className={marketingBtnOutline}>
          <Link href="/faq">View all FAQs</Link>
        </Button>
      </div>

      <MarketingFinalCta
        heading="Run the studio from one home"
        subheading="If your stack is fragmented, Ozer brings projects, people, plans, and priorities into one calm workspace."
        cta={{ label: 'Start free', href: MARKETING_FREE_SIGNUP_URL }}
      />
    </main>
  );
}

export default withI18n(Home);
