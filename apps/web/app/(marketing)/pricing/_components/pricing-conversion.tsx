import Link from 'next/link';

import { Button } from '@kit/ui/button';

import {
  annualSavingPercent,
  formatAnnualSavingPercent,
  formatGbp,
  listBusinessWorkspacePrices,
} from '~/lib/billing/billing-config-prices';
import {
  buildPricingSignupUrl,
  MARKETING_FREE_SIGNUP_URL,
} from '~/lib/billing/pricing-marketing';
import {
  businessTierCards,
  philosophyLine,
  pricingFaqs,
  PRICING_LAST_VERIFIED,
  replacedStackMonthlyTotal,
  REPLACED_STACK,
} from '~/lib/marketing/pricing-content';
import { MarketingFaqsSection } from '~/(marketing)/_components/marketing-faqs';
import { PlanRecommender } from './plan-recommender';
import {
  marketingBodyText,
  marketingBtnGradient,
  marketingBtnOutline,
  marketingEyebrow,
  marketingFeatureCard,
  marketingMutedText,
} from '~/lib/marketing/marketing-ui';
import { cn } from '@kit/ui/utils';

const FEATURE_MATRIX: Array<{
  feature: string;
  href?: string;
  hint?: string;
  lite: boolean | string;
  solo: boolean | string;
  team: boolean | string;
  scale: boolean | string;
}> = [
  { feature: 'Apps marketplace', href: '/apps', lite: true, solo: true, team: true, scale: true },
  { feature: 'Team & brand settings', lite: true, solo: true, team: true, scale: true },
  {
    feature: 'Clients, jobs, invoices & tasks',
    href: '/features/pipeline',
    lite: false,
    solo: true,
    team: true,
    scale: true,
  },
  {
    feature: 'Activity tracking',
    href: '/features/activity',
    hint: 'Mac sessions assigned to clients and projects',
    lite: false,
    solo: true,
    team: true,
    scale: true,
  },
  {
    feature: 'Docs, finances & pipeline',
    href: '/features/finances',
    lite: false,
    solo: true,
    team: true,
    scale: true,
  },
  {
    feature: 'Meeting Assistant',
    href: '/features/desktop-assistant',
    hint: 'Mac meetings → tasks; personal add-on',
    lite: 'Add-on',
    solo: 'Add-on',
    team: 'Add-on',
    scale: 'Add-on',
  },
  {
    feature: 'Dictation',
    href: '/features/dictation',
    hint: 'Included with Meeting Assistant for Mac',
    lite: 'Add-on',
    solo: 'Add-on',
    team: 'Add-on',
    scale: 'Add-on',
  },
  {
    feature: 'Email Assistant',
    href: '/features/email-assistant',
    hint: 'Gmail sync & drafts; £9/mo personal add-on',
    lite: 'Add-on',
    solo: 'Add-on',
    team: 'Add-on',
    scale: 'Add-on',
  },
  {
    feature: 'Monthly AI credits',
    hint: 'Shared AI allowance for drafts and assistants',
    lite: '500',
    solo: '2,000',
    team: '2,000',
    scale: '2,000',
  },
  {
    feature: 'Signatures',
    href: '/apps/signatures',
    hint: 'Flat mailbox tiers from £9/mo',
    lite: 'Add-on',
    solo: 'Add-on',
    team: 'Add-on',
    scale: 'Add-on',
  },
  { feature: 'Team members included', lite: 'Up to 3', solo: '1', team: 'Up to 5', scale: 'Up to 15' },
  { feature: 'Shared client & project work', lite: false, solo: false, team: true, scale: true },
  { feature: 'Priority support', lite: false, solo: false, team: false, scale: true },
  { feature: 'Ozer subscription transaction fees', lite: 'None', solo: 'None', team: 'None', scale: 'None' },
];

function cell(value: boolean | string) {
  if (value === true) return 'Included';
  if (value === false) return 'Not included';
  return value;
}

export function PricingConversion() {
  const tiers = businessTierCards();
  const stackMonthly = replacedStackMonthlyTotal();
  const team = listBusinessWorkspacePrices().find(
    (p) => p.productId === 'ozer-business-team',
  );
  const teamMonthly = team?.monthlyPriceGbp ?? 79;
  const faqs = pricingFaqs();

  return (
    <div className="space-y-16">
      {/* Stage 1 — which bucket */}
      <section className="text-center">
        <p className={marketingEyebrow}>Pricing</p>
        <h1 className="font-heading mt-4 text-4xl font-bold tracking-tight text-[var(--workspace-shell-text)] md:text-5xl">
          Flat price for the whole team
        </h1>
        <p className={cn('mx-auto mt-4 max-w-2xl text-lg leading-relaxed', marketingBodyText)}>
          {philosophyLine()}
        </p>
        <p className={cn('mt-2 text-sm', marketingMutedText)}>
          Prices last verified {PRICING_LAST_VERIFIED}.
        </p>
      </section>

      <section aria-labelledby="tier-cards-heading">
        <h2 id="tier-cards-heading" className="sr-only">
          Business workspace tiers
        </h2>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
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
                  'flex flex-col rounded-2xl border p-6',
                  marketingFeatureCard,
                  plan.highlighted &&
                    'border-[var(--ozer-accent)] shadow-[0_0_0_1px_var(--ozer-coral-alpha-45)]',
                )}
              >
                {plan.badge ? (
                  <span className="mb-2 w-fit rounded-full bg-[var(--ozer-accent)] px-2 py-0.5 text-xs font-semibold text-[var(--ozer-plum-950)]">
                    {plan.badge}
                  </span>
                ) : null}
                <h3 className="font-heading text-xl font-semibold text-[var(--workspace-shell-text)]">
                  {plan.productName}
                </h3>
                <p className={cn('mt-1 text-sm', marketingMutedText)}>
                  {plan.description}
                </p>
                <p className="mt-4 text-3xl font-bold tracking-tight text-[var(--workspace-shell-text)]">
                  {formatGbp(plan.monthlyPriceGbp)}
                  <span className={cn('text-base font-normal', marketingMutedText)}>
                    {' '}
                    per month
                  </span>
                </p>
                {plan.yearlyPriceGbp != null && plan.monthlyPriceGbp > 0 ? (
                  <p className={cn('mt-1 text-sm', marketingMutedText)}>
                    or {formatGbp(plan.yearlyPriceGbp)} per year
                    {saving
                      ? ` (${saving} less than 12 × monthly)`
                      : null}
                  </p>
                ) : null}
                <p className="mt-3 text-sm font-medium text-[var(--workspace-shell-text)]">
                  {plan.translation}
                </p>
                <p className={cn('mt-2 text-sm', marketingMutedText)}>{plan.trial}</p>
                <ul className={cn('mt-4 flex-1 space-y-1.5 text-sm', marketingMutedText)}>
                  {plan.includes.map((item) => (
                    <li key={item}>· {item}</li>
                  ))}
                </ul>
                <Button asChild className={cn('mt-6 w-full', marketingBtnGradient)}>
                  <Link href={signup}>Start free</Link>
                </Button>
              </article>
            );
          })}
        </div>
        <p className={cn('mt-4 text-center text-sm', marketingMutedText)}>
          Personal and family workspaces are free forever.
        </p>
      </section>

      <PlanRecommender />

      {/* What this replaces */}
      <section
        className={cn(
          'rounded-2xl border border-[color:var(--workspace-shell-border)] p-6 md:p-8',
          marketingFeatureCard,
        )}
        aria-labelledby="replaces-heading"
      >
        <h2
          id="replaces-heading"
          className="font-heading text-2xl font-semibold text-[var(--workspace-shell-text)]"
        >
          What this replaces
        </h2>
        <p className={cn('mt-2 max-w-2xl text-sm', marketingBodyText)}>
          Typical UK monthly spend on separate tools a small studio often pays for — not a
          promise that every studio pays exactly this.
        </p>
        <ul className="mt-6 divide-y divide-[color:var(--workspace-shell-border)]">
          {REPLACED_STACK.map((row) => (
            <li
              key={row.category}
              className="flex flex-wrap items-baseline justify-between gap-2 py-3 text-sm"
            >
              <span className="text-[var(--workspace-shell-text)]">
                {row.category}
                <span className={cn('ml-2', marketingMutedText)}>({row.note})</span>
              </span>
              <span className="font-medium text-[var(--workspace-shell-text)]">
                {formatGbp(row.typicalMonthlyGbp)} per month
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-4 text-sm text-[var(--workspace-shell-text)]">
          Typical stack total: <strong>{formatGbp(stackMonthly)} per month</strong> (
          {formatGbp(stackMonthly * 12)} per year). Ozer Business Team is{' '}
          <strong>{formatGbp(teamMonthly)} per month</strong> — flat price for the whole team
          (up to {team?.maxTeamMembers ?? 5} members).
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

      {/* Crawlable feature matrix */}
      <section aria-labelledby="matrix-heading">
        <h2
          id="matrix-heading"
          className="font-heading text-2xl font-semibold text-[var(--workspace-shell-text)]"
        >
          Feature-by-tier compare
        </h2>
        <p className={cn('mt-2 text-sm', marketingMutedText)}>
          Explicit includes and excludes. Seat limits are stated as numbers, not “unlimited”.
        </p>
        <div className="mt-4 overflow-x-auto rounded-2xl border border-[color:var(--workspace-shell-border)]">
          <table className="w-full min-w-[40rem] text-left text-sm">
            <thead>
              <tr className="border-b border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)]">
                <th className="px-4 py-3 font-semibold">Feature</th>
                <th className="px-4 py-3 font-semibold">Lite</th>
                <th className="px-4 py-3 font-semibold">Solo</th>
                <th className="px-4 py-3 font-semibold">Team</th>
                <th className="px-4 py-3 font-semibold">Scale</th>
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
                      <Link href={row.href} className="underline-offset-2 hover:underline">
                        {row.feature}
                      </Link>
                    ) : (
                      row.feature
                    )}
                    {row.hint ? (
                      <span className={cn('mt-0.5 block text-xs font-normal', marketingMutedText)}>
                        {row.hint}
                      </span>
                    ) : null}
                  </th>
                  <td className={cn('px-4 py-3', marketingMutedText)}>{cell(row.lite)}</td>
                  <td className={cn('px-4 py-3', marketingMutedText)}>{cell(row.solo)}</td>
                  <td className={cn('px-4 py-3', marketingMutedText)}>{cell(row.team)}</td>
                  <td className={cn('px-4 py-3', marketingMutedText)}>{cell(row.scale)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {tiers.map((plan) => {
          const pct = annualSavingPercent(plan);
          return pct != null && pct > 0 ? (
            <p key={plan.productId} className={cn('mt-2 text-xs', marketingMutedText)}>
              {plan.productName} annual billing is {formatAnnualSavingPercent(plan)} less than
              paying monthly for twelve months ({formatGbp(plan.monthlyPriceGbp * 12)} vs{' '}
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

      <footer className={cn('border-t border-[color:var(--workspace-shell-border)] pt-10')}>
        <h2 className="font-heading text-xl font-semibold text-[var(--workspace-shell-text)]">
          More on pricing
        </h2>
        <ul className={cn('mt-4 flex flex-wrap gap-4 text-sm', marketingBodyText)}>
          <li>
            <Link href="/pricing/explained" className="underline underline-offset-2">
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
          <Button asChild className={marketingBtnGradient}>
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
