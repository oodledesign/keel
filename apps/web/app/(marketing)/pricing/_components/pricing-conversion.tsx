import Link from 'next/link';

import { Button } from '@kit/ui/button';
import { cn } from '@kit/ui/utils';

import { BusinessSeatCalculator } from '~/(marketing)/_components/business-seat-calculator';
import { MarketingFaqsSection } from '~/(marketing)/_components/marketing-faqs';
import {
  MarketingSectionHeader,
  MarketingSectionIndex,
} from '~/(marketing)/_components/marketing-section-index';
import {
  annualSavingPercent,
  formatAnnualSavingPercent,
  formatGbp,
} from '~/lib/billing/billing-config-prices';
import { estimateMonthlyGbp } from '~/lib/billing/business-graduated-pricing';
import {
  MARKETING_FREE_SIGNUP_URL,
  buildPricingSignupUrl,
} from '~/lib/billing/pricing-marketing';
import {
  marketingBodyText,
  marketingBtnOutline,
  marketingBtnPrimary,
  marketingDisplay,
  marketingFeaturedPlan,
  marketingFigure,
  marketingLede,
  marketingMutedText,
  marketingPlanBadge,
  marketingRadiusMedia,
  marketingRule,
} from '~/lib/marketing/marketing-ui';
import {
  PRICING_LAST_VERIFIED,
  REPLACED_STACK,
  businessTierCards,
  philosophyLine,
  pricingFaqs,
  replacedStackMonthlyTotal,
} from '~/lib/marketing/pricing-content';

import { WorkspaceFeatureComparison } from '../../_components/workspace-feature-comparison';
import { PlanRecommender } from './plan-recommender';

const FEATURE_MATRIX: Array<{
  feature: string;
  href?: string;
  hint?: string;
  lite: boolean | string;
  starter: boolean | string;
  pro: boolean | string;
}> = [
  {
    feature: 'Monthly price',
    hint: 'Starter and Pro use graduated seats',
    lite: 'Free',
    starter: 'From £14 / seat',
    pro: 'From £29 / seat',
  },
  {
    feature: 'Billable seats',
    hint: 'Owners, admins, staff, and contractors',
    lite: 'Up to 2 members',
    starter: '£14 then £9 extra',
    pro: '£29 then £22 extra',
  },
  {
    feature: 'Project guests',
    hint: 'External collaborators on one project. They are not paid seats.',
    lite: '1',
    starter: '1 per billable seat',
    pro: '3 per billable seat',
  },
  {
    feature: 'Client portal contacts',
    lite: 'Unlimited',
    starter: 'Unlimited',
    pro: 'Unlimited',
  },
  {
    feature: 'Share with other paid workspaces',
    lite: false,
    starter: false,
    pro: true,
  },
  {
    feature: '14-day free trial',
    hint: 'On your first paid workspace. Card on file, billed after 14 days.',
    lite: false,
    starter: true,
    pro: true,
  },
  {
    feature: 'Apps marketplace',
    href: '/apps',
    lite: true,
    starter: true,
    pro: true,
  },
  {
    feature: 'Monthly AI credits',
    hint: 'One shared workspace pool for drafts, summaries, coaching, and other model use. Pro scales with seats.',
    lite: '200',
    starter: 'Same workspace pool',
    pro: 'From 3,000',
  },
  {
    feature: 'Clients & invoices',
    href: '/features/pipeline',
    lite: '3 clients · 5 invoices/mo',
    starter: 'Unlimited',
    pro: 'Unlimited',
  },
  {
    feature: 'Open tasks & bookings',
    lite: '20 tasks · 5 bookings/mo',
    starter: 'Unlimited',
    pro: 'Unlimited',
  },
  {
    feature: 'Planner',
    href: '/features/planner',
    lite: false,
    starter: false,
    pro: true,
  },
  {
    feature: 'Meeting recording & transcription',
    href: '/features/desktop-assistant',
    lite: '5 hrs/mo',
    starter: 'Unlimited',
    pro: 'Unlimited',
  },
  {
    feature: 'Email assistant, coaching & auto tasks',
    href: '/features/email-assistant',
    lite: false,
    starter: false,
    pro: true,
  },
  {
    feature: 'Signatures / Media Generate',
    href: '/apps',
    lite: 'Add-on',
    starter: 'Add-on',
    pro: 'Add-on',
  },
];

function cell(value: boolean | string) {
  if (value === true) return 'Included';
  if (value === false) return 'Not included';
  return value;
}

export function PricingConversion() {
  const tiers = businessTierCards();
  const stackMonthly = replacedStackMonthlyTotal();
  const teamMonthly = estimateMonthlyGbp(4);
  const faqs = pricingFaqs();

  return (
    <div className="space-y-24">
      <section>
        <MarketingSectionIndex
          label="Pricing"
          aside={
            <span className="tabular-nums">
              Last verified {PRICING_LAST_VERIFIED}
            </span>
          }
        />
        <div className="mt-10 grid gap-8 lg:grid-cols-12 lg:items-end">
          <h1
            className={cn(
              marketingDisplay,
              'text-[var(--workspace-shell-text)] lg:col-span-8 lg:text-[4.75rem]',
            )}
          >
            Graduated seats for your studio.
          </h1>
          <p className={cn(marketingLede, marketingBodyText, 'lg:col-span-4')}>
            {philosophyLine()}
          </p>
        </div>
      </section>

      <section aria-labelledby="tier-cards-heading">
        <h2 id="tier-cards-heading" className="sr-only">
          Business workspace tiers
        </h2>
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {tiers.map((plan) => {
            const saving = formatAnnualSavingPercent(plan);
            const signup = buildPricingSignupUrl({
              profile: 'work_design',
              productId: plan.productId,
              planId: plan.monthlyPlanId ?? undefined,
            });

            return (
              <article
                key={plan.productId}
                className={cn(
                  'relative flex flex-col border p-6',
                  marketingRadiusMedia,
                  plan.highlighted
                    ? marketingFeaturedPlan
                    : 'border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)]',
                )}
              >
                {plan.badge ? (
                  <span
                    className={cn(marketingPlanBadge, 'absolute -top-3 left-6')}
                  >
                    {plan.badge}
                  </span>
                ) : null}
                <h3 className="font-heading text-[1.75rem] leading-tight font-medium text-[var(--workspace-shell-text)]">
                  {plan.productName}
                </h3>
                <p className={cn('mt-1 text-sm', marketingMutedText)}>
                  {plan.description}
                </p>
                <p
                  className={cn(
                    marketingFigure,
                    'mt-6 text-[3rem] leading-none text-[var(--workspace-shell-text)]',
                  )}
                >
                  {formatGbp(plan.monthlyPriceGbp)}
                  <span
                    className={cn(
                      'ml-1 font-sans text-base font-normal tracking-normal',
                      marketingMutedText,
                    )}
                  >
                    per month
                  </span>
                </p>
                {plan.yearlyPriceGbp != null && plan.monthlyPriceGbp > 0 ? (
                  <p className={cn('mt-1 text-sm', marketingMutedText)}>
                    or {formatGbp(plan.yearlyPriceGbp)} per year
                    {saving ? ` (${saving} less than 12 × monthly)` : null}
                  </p>
                ) : null}
                <p className="mt-3 text-sm font-medium text-[var(--workspace-shell-text)]">
                  {plan.translation}
                </p>
                <p className={cn('mt-2 text-sm', marketingMutedText)}>
                  {plan.trial}
                </p>
                <ul
                  className={cn(
                    marketingRule,
                    'mt-5 flex-1 divide-y divide-[color:var(--workspace-shell-border)] border-t text-sm',
                    marketingMutedText,
                  )}
                >
                  {plan.includes.map((item) => (
                    <li key={item} className="py-2">
                      {item}
                    </li>
                  ))}
                </ul>
                <Button
                  asChild
                  className={cn(
                    'mt-6 w-full',
                    plan.highlighted
                      ? marketingBtnPrimary
                      : marketingBtnOutline,
                  )}
                  variant={plan.highlighted ? 'default' : 'outline'}
                >
                  <Link href={signup}>Start free</Link>
                </Button>
              </article>
            );
          })}
        </div>
        <p className={cn('mt-4 text-center text-sm', marketingMutedText)}>
          Personal and family workspaces are free forever.
        </p>
        <div className="mt-10">
          <BusinessSeatCalculator variant="light" />
        </div>
      </section>

      <PlanRecommender />

      {/* What this replaces */}
      <section aria-labelledby="replaces-heading">
        <MarketingSectionHeader
          label="What this replaces"
          title="The separate tools you stop paying for."
          intro="Typical UK monthly spend on the tools a small studio often pays for. Your own stack will differ."
          headingId="replaces-heading"
        />
        <ul
          className={cn(
            marketingRule,
            'mt-10 divide-y divide-[color:var(--workspace-shell-border)] border-y',
          )}
        >
          {REPLACED_STACK.map((row) => (
            <li
              key={row.category}
              className="flex flex-wrap items-baseline justify-between gap-2 py-3 text-sm"
            >
              <span className="text-[var(--workspace-shell-text)]">
                {row.category}
                <span className={cn('ml-2', marketingMutedText)}>
                  ({row.note})
                </span>
              </span>
              <span className="font-medium text-[var(--workspace-shell-text)] tabular-nums">
                {formatGbp(row.typicalMonthlyGbp)} per month
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-4 text-sm text-[var(--workspace-shell-text)]">
          Typical stack total:{' '}
          <strong>{formatGbp(stackMonthly)} per month</strong> (
          {formatGbp(stackMonthly * 12)} per year). Ozer Pro for four seats is{' '}
          <strong>{formatGbp(teamMonthly)} per month</strong> on graduated
          pricing (£29 + 3 × £22).
        </p>
        <p className={cn('mt-2 text-sm', marketingMutedText)}>
          Run your own numbers in the{' '}
          <Link
            href="/tools/stack-cost-calculator"
            className="underline underline-offset-2"
          >
            stack cost calculator
          </Link>
          .
        </p>
      </section>

      <WorkspaceFeatureComparison variant="full" />

      <section aria-labelledby="matrix-heading">
        <MarketingSectionHeader
          label="Plan detail"
          title="Free, Starter and Pro seats"
          intro="Seat limits inside Business. Use the calculator above for monthly totals, or open the comparison for the full tier list."
          headingId="matrix-heading"
        />
        <details className="mt-10">
          <summary
            className={cn(
              marketingBtnOutline,
              'inline-flex cursor-pointer list-none items-center gap-2 px-5 py-2.5 text-sm font-medium [&::-webkit-details-marker]:hidden',
            )}
          >
            Compare plans in detail
          </summary>
          <div className="mt-4 overflow-x-auto rounded-[var(--ozer-radius-media)] border border-[color:var(--workspace-shell-border)]">
            <table className="w-full min-w-[28rem] text-left text-sm">
              <thead>
                <tr className="border-b border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)]">
                  <th className="px-4 py-3 font-semibold">Feature</th>
                  <th className="px-4 py-3 font-semibold">Free</th>
                  <th className="px-4 py-3 font-semibold">Starter</th>
                  <th className="px-4 py-3 font-semibold">Pro</th>
                </tr>
              </thead>
              <tbody>
                {FEATURE_MATRIX.map((row) => (
                  <tr
                    key={row.feature}
                    className="border-b border-[color:var(--workspace-shell-border)] last:border-b-0"
                  >
                    <th scope="row" className="px-4 py-3 font-medium">
                      {row.href ? (
                        <Link
                          href={row.href}
                          className="underline-offset-2 hover:underline"
                        >
                          {row.feature}
                        </Link>
                      ) : (
                        row.feature
                      )}
                      {row.hint ? (
                        <span
                          className={cn(
                            'mt-0.5 block text-xs font-normal',
                            marketingMutedText,
                          )}
                        >
                          {row.hint}
                        </span>
                      ) : null}
                    </th>
                    <td className={cn('px-4 py-3', marketingMutedText)}>
                      {cell(row.lite)}
                    </td>
                    <td className={cn('px-4 py-3', marketingMutedText)}>
                      {cell(row.starter)}
                    </td>
                    <td className={cn('px-4 py-3', marketingMutedText)}>
                      {cell(row.pro)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
        {tiers.map((plan) => {
          const pct = annualSavingPercent(plan);
          return pct != null && pct > 0 ? (
            <p
              key={plan.productId}
              className={cn('mt-2 text-xs', marketingMutedText)}
            >
              {plan.productName} annual billing is{' '}
              {formatAnnualSavingPercent(plan)} less than paying monthly for
              twelve months ({formatGbp(plan.monthlyPriceGbp * 12)} vs{' '}
              {formatGbp(plan.yearlyPriceGbp ?? 0)}).
            </p>
          ) : null;
        })}
      </section>

      <MarketingFaqsSection
        faqs={faqs}
        tone="light"
        title="Pricing FAQ"
        headingId="pricing-faq-heading"
      />

      <footer
        className={cn(
          'border-t border-[color:var(--workspace-shell-border)] pt-10',
        )}
      >
        <h2 className="font-heading text-xl font-semibold text-[var(--workspace-shell-text)]">
          More on pricing
        </h2>
        <ul
          className={cn('mt-4 flex flex-wrap gap-4 text-sm', marketingBodyText)}
        >
          <li>
            <Link
              href="/pricing/explained"
              className="underline underline-offset-2"
            >
              Ozer pricing, explained
            </Link>
          </li>
          <li>
            <Link
              href="/tools/stack-cost-calculator"
              className="underline underline-offset-2"
            >
              Stack cost calculator
            </Link>
          </li>
          <li>
            <Link href="/compare" className="underline underline-offset-2">
              Compare Ozer to other tools
            </Link>
          </li>
        </ul>
        <div className="mt-8 flex flex-wrap gap-3">
          <Button asChild className={marketingBtnPrimary}>
            <Link href={MARKETING_FREE_SIGNUP_URL}>Start free</Link>
          </Button>
          <Button asChild variant="outline" className={marketingBtnOutline}>
            <Link href="/pricing/explained">See full pricing answer</Link>
          </Button>
        </div>
      </footer>
    </div>
  );
}
