import Link from 'next/link';

import { cn } from '@kit/ui/utils';

import {
  BILLING_TRIAL_DAYS,
  formatGbp,
  getBillingProductPrice,
  listBusinessWorkspacePrices,
} from '~/lib/billing/billing-config-prices';
import { MARKETING_FREE_TIER } from '~/lib/billing/pricing-marketing';
import { withI18n } from '~/lib/i18n/with-i18n';
import {
  marketingBodyText,
  marketingEyebrow,
  marketingMutedText,
  marketingShellClass,
} from '~/lib/marketing/marketing-ui';
import {
  PRICING_LAST_VERIFIED,
  annualCostForTeamSize,
  philosophyLine,
} from '~/lib/marketing/pricing-content';
import { JsonLd } from '~/lib/seo/json-ld';
import { buildMarketingMetadata } from '~/lib/seo/marketing-metadata';
import {
  articleJsonLd,
  breadcrumbJsonLd,
  faqPageJsonLd,
  schemaGraph,
} from '~/lib/seo/schema';

const FAQS = () => {
  const lite = getBillingProductPrice('ozer-business-lite');
  const solo = getBillingProductPrice('ozer-business-solo');
  const team = getBillingProductPrice('ozer-business-team');
  const scale = getBillingProductPrice('ozer-business-scale');

  return [
    {
      question: 'How much does Ozer cost per month?',
      answer: `Personal and family are free. Business Lite is ${formatGbp(lite?.monthlyPriceGbp ?? 0)} per month. Business Solo is ${formatGbp(solo?.monthlyPriceGbp ?? 29)} per month. Business Team is ${formatGbp(team?.monthlyPriceGbp ?? 79)} per month. Business Scale is ${formatGbp(scale?.monthlyPriceGbp ?? 149)} per month. Personal and family workspaces are free forever.`,
    },
    {
      question: 'Does Ozer charge per user?',
      answer:
        'No. Each paid workspace is a flat price for the whole team up to the seat limit on that tier. You do not multiply Solo by headcount.',
    },
    {
      question: 'Does Ozer take a cut of my invoices?',
      answer:
        'No. The Ozer subscription has no platform transaction fee. Client card payments use Stripe; those fees are Stripe’s.',
    },
    {
      question: 'Is there a free trial?',
      answer: `Personal and family are free forever. Business Lite is free. Paid workspaces include a ${BILLING_TRIAL_DAYS}-day free trial on your first paid workspace.`,
    },
    {
      question: 'How does Ozer pricing compare to Bonsai and HoneyBook?',
      answer:
        'Bonsai and HoneyBook often use per-user or tiered US pricing, sometimes with card fees. Ozer uses flat GBP workspace prices. See the comparison pages for worked examples.',
    },
  ];
};

export const metadata = buildMarketingMetadata({
  title: 'How much does Ozer cost? — Ozer',
  description:
    'Exact Ozer prices in £: personal free; Business Lite £0; Solo £29; Team £79; Scale £149 per month. Flat price for the whole team. No per-user charge.',
  path: '/pricing/explained',
  ogType: 'pricing',
  keywords: [
    'how much does Ozer cost',
    'Ozer pricing UK',
    'Ozer cost per month',
    'does Ozer charge per user',
  ],
});

function PricingExplainedPage() {
  const solo = annualCostForTeamSize(1);
  const four = annualCostForTeamSize(4);
  const ten = annualCostForTeamSize(10);
  const business = listBusinessWorkspacePrices();
  const faqs = FAQS();

  const answerFirst = `Ozer costs ${formatGbp(0)} per month for personal and family workspaces. Business Lite is ${formatGbp(business.find((p) => p.productId === 'ozer-business-lite')?.monthlyPriceGbp ?? 0)} per month. Business Solo is ${formatGbp(solo.monthlyGbp)} per month for one member. Business Team is ${formatGbp(four.monthlyGbp)} per month for up to five members. Business Scale is ${formatGbp(ten.monthlyGbp)} per month for up to fifteen members. Prices are flat for the whole team, in pounds, with no per-user charge and no Ozer cut on invoices.`;

  return (
    <main className={cn('relative overflow-hidden', marketingShellClass)}>
      <JsonLd
        data={schemaGraph([
          articleJsonLd({
            headline: 'How much does Ozer cost?',
            description: answerFirst,
            path: '/pricing/explained',
            authorName: 'Dan Potter',
            dateModified: PRICING_LAST_VERIFIED,
          }),
          breadcrumbJsonLd([
            { name: 'Home', path: '/' },
            { name: 'Pricing', path: '/pricing' },
            { name: 'Pricing explained', path: '/pricing/explained' },
          ]),
          faqPageJsonLd(faqs),
        ])}
      />

      <article className="relative mx-auto w-full max-w-3xl px-6 pt-24 pb-20 md:pt-28">
        <span className={marketingEyebrow}>Pricing explained</span>
        <h1 className="font-heading mt-4 text-4xl leading-tight font-bold text-[var(--workspace-shell-text)] md:text-5xl">
          How much does Ozer cost?
        </h1>

        <p className={cn('mt-6 text-lg leading-relaxed', marketingBodyText)}>
          {answerFirst}
        </p>
        <p className={cn('mt-2 text-sm', marketingMutedText)}>
          Last verified {PRICING_LAST_VERIFIED}. Figures read from billing
          config.
        </p>

        <p className={cn('mt-6 text-sm', marketingBodyText)}>
          {philosophyLine()}
        </p>

        <section className="mt-12" aria-labelledby="examples-heading">
          <h2
            id="examples-heading"
            className="font-heading text-2xl font-semibold text-[var(--workspace-shell-text)]"
          >
            Worked examples
          </h2>
          <ul className={cn('mt-4 space-y-4', marketingBodyText)}>
            <li>
              <strong>Solo freelancer:</strong> Business Solo at{' '}
              {formatGbp(solo.monthlyGbp)} per month (
              {formatGbp(solo.yearlyGbp)} per year on annual billing). Last
              verified {PRICING_LAST_VERIFIED}.
            </li>
            <li>
              <strong>4-person studio:</strong> Business Team at{' '}
              {formatGbp(four.monthlyGbp)} per month (
              {formatGbp(four.yearlyGbp)} per year) — flat price for the whole
              team, up to {four.plan.maxTeamMembers} members. Last verified{' '}
              {PRICING_LAST_VERIFIED}.
            </li>
            <li>
              <strong>10-person agency:</strong> Business Scale at{' '}
              {formatGbp(ten.monthlyGbp)} per month ({formatGbp(ten.yearlyGbp)}{' '}
              per year) — up to {ten.plan.maxTeamMembers} members. Last verified{' '}
              {PRICING_LAST_VERIFIED}.
            </li>
          </ul>
        </section>

        <section className="mt-12" aria-labelledby="all-tiers-heading">
          <h2
            id="all-tiers-heading"
            className="font-heading text-2xl font-semibold text-[var(--workspace-shell-text)]"
          >
            All published workspace prices
          </h2>
          <ul
            className={cn('mt-4 list-disc space-y-2 pl-5', marketingBodyText)}
          >
            <li>
              {MARKETING_FREE_TIER.name}: {formatGbp(0)} per month
            </li>
            {business.map((plan) => (
              <li key={plan.productId}>
                {plan.productName}: {formatGbp(plan.monthlyPriceGbp)} per month
                {plan.yearlyPriceGbp != null
                  ? ` (or ${formatGbp(plan.yearlyPriceGbp)} per year)`
                  : null}
                {plan.trialDays
                  ? ` — ${plan.trialDays}-day trial on first paid workspace`
                  : plan.monthlyPriceGbp === 0
                    ? ' — free forever'
                    : null}
              </li>
            ))}
          </ul>
          <p className={cn('mt-4 text-sm', marketingBodyText)}>
            More workspace types are coming. See{' '}
            <Link href="/#coming-soon" className="underline underline-offset-2">
              Growing with you
            </Link>{' '}
            for what is in development.
          </p>
        </section>

        {faqs.map((faq) => (
          <section key={faq.question} className="mt-10">
            <h2 className="font-heading text-xl font-semibold text-[var(--workspace-shell-text)]">
              {faq.question}
            </h2>
            <p className={cn('mt-2', marketingBodyText)}>{faq.answer}</p>
          </section>
        ))}

        <section className="mt-12">
          <h2 className="font-heading text-xl font-semibold text-[var(--workspace-shell-text)]">
            How does Ozer pricing compare to Bonsai and HoneyBook?
          </h2>
          <p className={cn('mt-2', marketingBodyText)}>
            See the neutral comparison pages for worked annual costs for a
            four-person UK studio. Competitor figures are sourced and flagged
            until verified.
          </p>
          <ul
            className={cn(
              'mt-3 list-disc space-y-1 pl-5 text-sm',
              marketingBodyText,
            )}
          >
            <li>
              <Link
                href="/compare/hellobonsai"
                className="underline underline-offset-2"
              >
                Hello Bonsai alternatives
              </Link>
            </li>
            <li>
              <Link
                href="/compare/honeybook"
                className="underline underline-offset-2"
              >
                HoneyBook alternatives
              </Link>
            </li>
            <li>
              <Link href="/compare" className="underline underline-offset-2">
                All comparisons
              </Link>
            </li>
          </ul>
        </section>

        <p className={cn('mt-12 text-sm', marketingMutedText)}>
          <Link href="/pricing" className="underline underline-offset-2">
            Pricing page
          </Link>
          {' · '}
          <Link
            href="/tools/stack-cost-calculator"
            className="underline underline-offset-2"
          >
            Stack cost calculator
          </Link>
        </p>
      </article>
    </main>
  );
}

export default withI18n(PricingExplainedPage);
