import Link from 'next/link';

import { cn } from '@kit/ui/utils';
import { marketingFeatureCard, marketingShellClass } from '~/lib/marketing/marketing-ui';
import { PricingConversion } from '~/(marketing)/pricing/_components/pricing-conversion';
import { withI18n } from '~/lib/i18n/with-i18n';
import {
  formatGbp,
  listBusinessWorkspacePrices,
} from '~/lib/billing/billing-config-prices';
import { MARKETING_FREE_TIER } from '~/lib/billing/pricing-marketing';
import {
  pricingFaqs,
  replacedStackMonthlyTotal,
} from '~/lib/marketing/pricing-content';
import { buildMarketingMetadata } from '~/lib/seo/marketing-metadata';
import { JsonLd } from '~/lib/seo/json-ld';
import {
  absoluteUrl,
  breadcrumbJsonLd,
  faqPageJsonLd,
  schemaGraph,
  softwareApplicationJsonLd,
} from '~/lib/seo/schema';

export const metadata = buildMarketingMetadata({
  title: 'Pricing — flat team price — Ozer',
  description:
    'Ozer pricing: personal and family free; business from £0–£149 per month. Flat price for the whole team — no per-seat maths, no subscription transaction fees.',
  path: '/pricing',
  ogType: 'pricing',
  keywords: [
    'Ozer pricing',
    'freelance software pricing UK',
    'agency CRM cost',
    'flat team pricing',
  ],
});

async function PricingPage() {
  const business = listBusinessWorkspacePrices();
  const offers = [
    {
      name: MARKETING_FREE_TIER.name,
      price: 0,
      description: MARKETING_FREE_TIER.description,
      url: absoluteUrl('/pricing'),
    },
    ...business.map((plan) => ({
      name: plan.productName,
      price: plan.monthlyPriceGbp,
      description: plan.description,
      url: absoluteUrl('/pricing'),
    })),
  ];

  const schema = schemaGraph([
    softwareApplicationJsonLd({
      name: 'Ozer',
      description:
        'Workspace OS pricing in GBP — flat price for the whole team per workspace.',
      url: absoluteUrl('/pricing'),
      offers,
    }),
    breadcrumbJsonLd([
      { name: 'Home', path: '/' },
      { name: 'Pricing', path: '/pricing' },
    ]),
    faqPageJsonLd(pricingFaqs()),
  ]);

  const stackYear = replacedStackMonthlyTotal() * 12;
  const team = business.find((p) => p.productId === 'keel-business-team');

  return (
    <div className={cn('relative overflow-hidden', marketingShellClass)}>
      <JsonLd data={schema} />
      <div className="relative flex flex-col">
        <div className="container mx-auto px-4 pb-8 pt-8 xl:pb-16">
          <PricingConversion />

          {/* Stage 4 — calculator bridge (full tool on its own route) */}
          <section
            className={cn(
              'mt-16 rounded-2xl border border-[color:var(--workspace-shell-border)] p-6 md:p-8',
              marketingFeatureCard,
            )}
            aria-labelledby="calculator-heading"
          >
            <h2
              id="calculator-heading"
              className="font-heading text-2xl font-semibold text-[var(--workspace-shell-text)]"
            >
              What does this mean for your studio?
            </h2>
            <p className="mt-2 max-w-2xl text-sm text-[var(--workspace-shell-text-muted)]">
              A typical UK tool stack in our strip totals about {formatGbp(stackYear)} per
              year. Ozer Business Team is {formatGbp(team?.yearlyPriceGbp ?? 790)} per year
              — flat price for the whole team. Build your own stack below.
            </p>
            <Link
              href="/tools/stack-cost-calculator"
              className="mt-4 inline-flex text-sm font-medium text-[var(--ozer-coral-600)] underline underline-offset-2"
            >
              Open the stack cost calculator
            </Link>
          </section>
        </div>
      </div>
    </div>
  );
}

export default withI18n(PricingPage);
