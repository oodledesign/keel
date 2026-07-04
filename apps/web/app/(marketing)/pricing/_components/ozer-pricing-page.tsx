'use client';

import Link from 'next/link';
import { useMemo, useState, type ReactNode } from 'react';

import { ArrowRight, Check } from 'lucide-react';

import { Button } from '@kit/ui/button';
import { cn } from '@kit/ui/utils';

import pathsConfig from '~/config/paths.config';
import {
  MARKETING_ADDON_PLANS,
  MARKETING_FREE_TIER,
  MARKETING_WORKSPACE_PLANS,
  type BillingInterval,
  type MarketingWorkspacePlan,
  buildPricingSignupUrl,
  formatGbp,
  planIdForInterval,
} from '~/lib/billing/pricing-marketing';
import { getSegmentPricingComparison } from '~/lib/marketing/pricing-comparison';
import type { SegmentSlug } from '~/lib/marketing/segment-landing-pages';
import {
  marketingBodyText,
  marketingBtnGradient,
  marketingBtnOutline,
  marketingFeatureCard,
  marketingFeaturedPlan,
  marketingMutedText,
} from '~/lib/marketing/marketing-ui';

import { PricingComparisonTable } from '../../_components/pricing-comparison-table';
import { InterconnectedWorkspacesSection } from '../../_components/interconnected-workspaces-section';

type WorkspaceCategory = 'community' | 'business' | 'property';

const CATEGORY_LABELS: Record<WorkspaceCategory, string> = {
  community: 'Community',
  business: 'Business',
  property: 'Property',
};

const CATEGORY_SEGMENT: Record<WorkspaceCategory, SegmentSlug> = {
  community: 'community',
  business: 'work',
  property: 'property',
};

export function OzerPricingPage() {
  const [interval, setInterval] = useState<BillingInterval>('month');
  const [category, setCategory] = useState<WorkspaceCategory>('business');

  const workspacePlans = useMemo(() => {
    return MARKETING_WORKSPACE_PLANS.filter((plan) => {
      if (category === 'community') return plan.profile === 'community';
      if (category === 'property') return plan.profile === 'work_property';
      return plan.profile === 'work_design';
    });
  }, [category]);

  const pricingComparison = useMemo(
    () => getSegmentPricingComparison(CATEGORY_SEGMENT[category]),
    [category],
  );

  const personalComparison = useMemo(
    () => getSegmentPricingComparison('personal'),
    [],
  );

  return (
    <div className="space-y-16">
      <section className="text-center">
        <p className={cn('mx-auto max-w-2xl text-lg leading-relaxed', marketingBodyText)}>
          Start free with personal and family — your hub for every workspace.
          Pay when you add community, business, or property. One price covers the
          team, not a per-seat tax. One Workspace OS, not a pile of siloed tools.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Button asChild size="lg" className={marketingBtnGradient}>
            <Link href={buildPricingSignupUrl({ profile: 'family' })}>
              Start free
              <ArrowRight className="ml-1.5 h-4 w-4" />
            </Link>
          </Button>
          <Button asChild size="lg" variant="outline" className={marketingBtnOutline}>
            <Link href={pathsConfig.auth.signIn}>Sign in</Link>
          </Button>
        </div>
        <p className={cn('mt-4 text-sm', marketingMutedText)}>
          14-day trial on your first paid workspace · Annual plans are 16.7% less than 12 × monthly
        </p>
      </section>

      <InterconnectedWorkspacesSection
        className="rounded-3xl border border-[color:var(--workspace-shell-border)]"
        tone="light"
      />

      <BillingIntervalToggle interval={interval} onChange={setInterval} />

      <PricingSection
        title="Always free"
        subtitle="No credit card required — upgrade only when you add a paid workspace"
      >
        <div className="mx-auto max-w-md">
          <FreePlanCard />
        </div>
        {personalComparison ? (
          <PricingComparisonTable
            comparison={personalComparison}
            className="mt-4"
          />
        ) : null}
      </PricingSection>

      <PricingSection
        title="Workspace plans"
        subtitle="Pick a category, then choose the tier when you create that workspace"
      >
        <div className="mb-6 flex flex-wrap justify-center gap-2">
          {(Object.keys(CATEGORY_LABELS) as WorkspaceCategory[]).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setCategory(key)}
              className={cn(
                'rounded-full px-4 py-2 text-sm font-medium transition',
                category === key
                  ? 'bg-[var(--ozer-accent)] text-[var(--ozer-plum-950)]'
                  : cn(marketingBtnOutline, 'h-auto px-4 py-2'),
              )}
            >
              {CATEGORY_LABELS[key]}
            </button>
          ))}
        </div>

        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {workspacePlans.map((plan) => (
            <WorkspacePlanCard key={plan.productId} plan={plan} interval={interval} />
          ))}
        </div>

        {pricingComparison ? (
          <PricingComparisonTable comparison={pricingComparison} className="mt-4" />
        ) : null}
      </PricingSection>

      <PricingSection
        title="Add-ons"
        subtitle="Optional modules billed separately per workspace. Videos includes private/public sharing, public links, branded players, and embeds for Webflow, WordPress, and any site."
      >
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {MARKETING_ADDON_PLANS.map((plan) => (
            <AddonPlanCard key={plan.productId} plan={plan} />
          ))}
        </div>
      </PricingSection>

      <section className={cn('rounded-2xl border border-[color:var(--workspace-shell-border)] px-6 py-10 text-center', marketingFeatureCard)}>
        <h2 className="text-xl font-semibold text-[var(--workspace-shell-text)]">Ready to run the studio?</h2>
        <p className={cn('mx-auto mt-2 max-w-lg text-sm', marketingBodyText)}>
          Start free, choose workspaces, and trial paid plans when you need them.
          Invited team members never pay — billing stays with the workspace owner.
        </p>
        <Button
          asChild
          className="mt-6 h-11 rounded-full bg-[var(--ozer-accent)] px-6 text-[var(--ozer-plum-950)] hover:bg-[var(--ozer-accent-hover)] hover:text-[var(--ozer-white)]"
          size="lg"
        >
          <Link href={buildPricingSignupUrl({})}>Start free</Link>
        </Button>
      </section>
    </div>
  );
}

function BillingIntervalToggle(props: {
  interval: BillingInterval;
  onChange: (interval: BillingInterval) => void;
}) {
  return (
    <div className="flex justify-center">
      <div className="inline-flex rounded-full border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)]/70 p-1">
        <button
          type="button"
          onClick={() => props.onChange('month')}
          className={cn(
            'rounded-full px-4 py-2 text-sm font-medium transition',
            props.interval === 'month'
              ? 'bg-[var(--workspace-shell-panel)] text-[var(--workspace-shell-text)] shadow-sm'
              : cn(marketingMutedText, 'hover:text-[var(--workspace-shell-text)]'),
          )}
        >
          Monthly
        </button>
        <button
          type="button"
          onClick={() => props.onChange('year')}
          className={cn(
            'rounded-full px-4 py-2 text-sm font-medium transition',
            props.interval === 'year'
              ? 'bg-[var(--workspace-shell-panel)] text-[var(--workspace-shell-text)] shadow-sm'
              : cn(marketingMutedText, 'hover:text-[var(--workspace-shell-text)]'),
          )}
        >
          Annual
          <span className="ml-1.5 text-xs text-[var(--ozer-accent)]">Save 16.7%</span>
        </button>
      </div>
    </div>
  );
}

function FreePlanCard() {
  return (
    <article className={cn('flex h-full flex-col rounded-2xl border border-[color:var(--workspace-shell-border)] p-6 text-[var(--workspace-shell-text)]', marketingFeatureCard)}>
      <h3 className="text-lg font-semibold">{MARKETING_FREE_TIER.name}</h3>
      <p className={cn('mt-1 text-sm', marketingMutedText)}>{MARKETING_FREE_TIER.description}</p>
      <p className="mt-4 text-3xl font-bold tracking-tight">Free</p>
      <FeatureList features={[...MARKETING_FREE_TIER.features]} />
      <div className="mt-6">
        <Button asChild className={cn(marketingBtnOutline, 'w-full')} variant="outline">
          <Link href={buildPricingSignupUrl({ profile: 'family' })}>Start free</Link>
        </Button>
      </div>
    </article>
  );
}

function WorkspacePlanCard(props: {
  plan: MarketingWorkspacePlan;
  interval: BillingInterval;
}) {
  const { plan, interval } = props;
  const price =
    interval === 'year' ? plan.yearlyPriceGbp : plan.monthlyPriceGbp;
  const planId = planIdForInterval(plan, interval);
  const signupUrl = buildPricingSignupUrl({
    profile: plan.profile,
    productId: plan.productId,
    planId,
    interval,
  });

  return (
    <article
      className={cn(
        'relative flex h-full flex-col rounded-2xl border p-6 text-[var(--workspace-shell-text)]',
        plan.highlighted
          ? marketingFeaturedPlan
          : cn('border-[color:var(--workspace-shell-border)]', marketingFeatureCard),
      )}
    >
      {plan.badge ? (
        <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-[var(--ozer-accent)] px-3 py-0.5 text-xs font-semibold text-[var(--ozer-plum-950)]">
          {plan.badge}
        </span>
      ) : null}
      <h3 className="text-lg font-semibold">{plan.name}</h3>
      <p className={cn('mt-1 text-sm', marketingMutedText)}>{plan.description}</p>
      <p className="mt-4 text-3xl font-bold tracking-tight">
        {formatGbp(price)}
        <span className={cn('text-base font-normal', marketingMutedText)}>
          {interval === 'year' ? '/yr' : '/mo'}
        </span>
      </p>
      {interval === 'year' ? (
        <p className="mt-1 text-xs text-[var(--ozer-accent)]">
          {formatGbp(Math.round(plan.yearlyPriceGbp / 12))}/mo billed annually
        </p>
      ) : null}
      <FeatureList features={plan.features} />
      <div className="mt-6 space-y-2">
        <Button
          asChild
          className={cn(
            'w-full rounded-full',
            plan.highlighted
              ? 'bg-[var(--ozer-accent)] text-[var(--ozer-plum-950)] hover:bg-[var(--ozer-accent-hover)] hover:text-[var(--ozer-white)]'
              : cn(marketingBtnOutline, 'h-auto'),
          )}
          variant={plan.highlighted ? 'default' : 'outline'}
        >
          <Link href={signupUrl}>
            Start free
            <ArrowRight className="ml-1.5 h-4 w-4" />
          </Link>
        </Button>
        <p className={cn('text-center text-xs', marketingMutedText)}>
          Sign up → create workspace → checkout
        </p>
      </div>
    </article>
  );
}

function AddonPlanCard(props: {
  plan: (typeof MARKETING_ADDON_PLANS)[number];
}) {
  const { plan } = props;

  return (
    <article className={cn('flex h-full flex-col rounded-2xl border border-[color:var(--workspace-shell-border)] p-6 text-[var(--workspace-shell-text)]', marketingFeatureCard)}>
      <h3 className="text-lg font-semibold">{plan.name}</h3>
      <p className={cn('mt-1 text-sm', marketingMutedText)}>{plan.description}</p>
      <p className="mt-4 text-2xl font-bold tracking-tight">
        {formatGbp(plan.monthlyPriceGbp)}
        <span className={cn('text-base font-normal', marketingMutedText)}>/mo</span>
      </p>
      <FeatureList features={plan.features} compact />
      <div className="mt-6">
        <Button asChild className={cn(marketingBtnOutline, 'w-full')} variant="outline">
          <Link href={buildPricingSignupUrl({})}>Start free</Link>
        </Button>
        <p className={cn('mt-2 text-center text-xs', marketingMutedText)}>
          Add-ons attach to a workspace after signup
        </p>
      </div>
    </article>
  );
}

function FeatureList(props: { features: string[]; compact?: boolean }) {
  return (
    <ul className={cn('mt-4 space-y-2', props.compact && 'text-sm')}>
      {props.features.map((feature) => (
        <li key={feature} className="flex gap-2">
          <Check className="mt-0.5 h-4 w-4 shrink-0 text-[var(--ozer-accent)]" />
          <span className={marketingBodyText}>{feature}</span>
        </li>
      ))}
    </ul>
  );
}

function PricingSection(props: {
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold tracking-tight text-[var(--workspace-shell-text)]">{props.title}</h2>
        <p className={cn('mt-1 text-sm', marketingMutedText)}>{props.subtitle}</p>
      </div>
      {props.children}
    </section>
  );
}
