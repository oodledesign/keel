import Link from 'next/link';

import { ArrowRight } from 'lucide-react';

import { cn } from '@kit/ui/utils';

import { MarketingSectionIndex } from '~/(marketing)/_components/marketing-section-index';
import { PricingConversion } from '~/(marketing)/pricing/_components/pricing-conversion';
import {
  formatGbp,
  listBusinessWorkspacePrices,
} from '~/lib/billing/billing-config-prices';
import { estimateMonthlyGbp } from '~/lib/billing/business-graduated-pricing';
import { MARKETING_FREE_TIER } from '~/lib/billing/pricing-marketing';
import { withI18n } from '~/lib/i18n/with-i18n';
import {
  marketingRule,
  marketingSectionHeading,
  marketingShellClass,
  marketingTextLink,
} from '~/lib/marketing/marketing-ui';
import {
  pricingFaqs,
  replacedStackMonthlyTotal,
} from '~/lib/marketing/pricing-content';
import { JsonLd } from '~/lib/seo/json-ld';
import { buildMarketingMetadata } from '~/lib/seo/marketing-metadata';
import {
  absoluteUrl,
  breadcrumbJsonLd,
  faqPageJsonLd,
  schemaGraph,
  softwareApplicationJsonLd,
} from '~/lib/seo/schema';

const STACK_EXTRAS: Array<{ label: string; href: string }> = [
  { label: 'Email Assistant (Pro)', href: '/features/email-assistant' },
  { label: 'Meeting recording', href: '/features/desktop-assistant' },
  { label: 'Activity tracking', href: '/features/activity' },
  { label: 'Planner (Pro)', href: '/features/planner' },
  { label: 'Tasks & pipeline', href: '/features/pipeline' },
];

function stackSavingPercent(
  stackYear: number,
  ozerYear: number,
): number | null {
  if (stackYear <= 0 || ozerYear >= stackYear) return null;
  return Math.floor(((stackYear - ozerYear) / stackYear) * 100);
}

export const metadata = buildMarketingMetadata({
  title: 'Pricing: graduated Business seats | Ozer',
  description:
    'Ozer pricing: personal and family free; Free (Business Lite) £0; Starter from £14; Pro from £29 with cheaper extra seats. No subscription transaction fees.',
  path: '/pricing',
  ogType: 'pricing',
  keywords: [
    'Ozer pricing',
    'freelance software pricing UK',
    'agency CRM cost',
    'graduated seat pricing',
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
        'Workspace OS pricing in GBP: Free, Starter from £14, and Pro from £29 with cheaper extra seats.',
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
  const fourSeatMonthly = estimateMonthlyGbp(4);
  const fourSeatYear = fourSeatMonthly * 10;
  const savingPct = stackSavingPercent(stackYear, fourSeatYear);

  return (
    <div className={cn('relative overflow-hidden', marketingShellClass)}>
      <JsonLd data={schema} />
      <div className="relative flex flex-col">
        <div className="mx-auto w-full max-w-[88rem] px-6 pt-24 pb-24 md:pt-32">
          <PricingConversion />

          <section className="mt-24" aria-labelledby="calculator-heading">
            <MarketingSectionIndex label="In practice" />
            <div className="mt-8 grid gap-8 lg:grid-cols-12 lg:gap-10">
              <h2
                id="calculator-heading"
                className={cn(
                  marketingSectionHeading,
                  'text-[var(--workspace-shell-text)] lg:col-span-5',
                )}
              >
                What does this mean for your studio?
              </h2>
              <div className="lg:col-span-6 lg:col-start-7">
                <p className="text-[1.0625rem] leading-relaxed text-[var(--workspace-shell-text-muted)]">
                  A typical UK tool stack in our strip totals about{' '}
                  {formatGbp(stackYear)} per year. Ozer Business for four seats
                  is about {formatGbp(fourSeatYear)} per year (
                  {formatGbp(fourSeatMonthly)}/mo on graduated pricing)
                  {savingPct != null ? (
                    <>
                      , about{' '}
                      <span className="font-medium text-[var(--workspace-shell-text)]">
                        {savingPct}% less
                      </span>
                    </>
                  ) : null}
                  . On top of the apps in that strip, you also get personal
                  assistants and tracking that usually sit in separate tools.
                </p>

                <ul className={cn(marketingRule, 'mt-8 border-b')}>
                  {STACK_EXTRAS.map(({ label, href }) => (
                    <li key={label} className={cn(marketingRule, 'border-t')}>
                      <Link
                        href={href}
                        className="group flex items-center justify-between py-3 text-sm font-medium text-[var(--workspace-shell-text)]"
                      >
                        {label}
                        <ArrowRight
                          className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5"
                          aria-hidden
                        />
                      </Link>
                    </li>
                  ))}
                </ul>

                <Link
                  href="/tools/stack-cost-calculator"
                  className={cn(
                    marketingTextLink,
                    'mt-6 text-[var(--workspace-shell-text)]',
                  )}
                >
                  Open the stack cost calculator
                </Link>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

export default withI18n(PricingPage);
