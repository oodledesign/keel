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

type WorkspaceCategory = 'community' | 'business' | 'property';

const CATEGORY_LABELS: Record<WorkspaceCategory, string> = {
  community: 'Community',
  business: 'Business',
  property: 'Property',
};

export function KeelPricingPage() {
  const [interval, setInterval] = useState<BillingInterval>('month');
  const [category, setCategory] = useState<WorkspaceCategory>('business');

  const workspacePlans = useMemo(() => {
    return MARKETING_WORKSPACE_PLANS.filter((plan) => {
      if (category === 'community') return plan.profile === 'community';
      if (category === 'property') return plan.profile === 'work_property';
      return plan.profile === 'work_design';
    });
  }, [category]);

  return (
    <div className="space-y-16">
      <section className="text-center">
        <p className="mx-auto max-w-2xl text-lg leading-relaxed text-violet-100/85">
          Start free with personal and family workspaces. Subscribe when you create a
          community, business, or property workspace — one plan per workspace, all
          managed from your Keel account.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Button
            asChild
            size="lg"
            className="h-11 rounded-full bg-gradient-to-r from-[#2A9D8F] to-[#2563EB] px-6 text-white hover:opacity-95"
          >
            <Link href={buildPricingSignupUrl({})}>
              Start free
              <ArrowRight className="ml-1.5 h-4 w-4" />
            </Link>
          </Button>
          <Button
            asChild
            size="lg"
            variant="outline"
            className="h-11 rounded-full border-white/20 bg-white/5 text-white hover:bg-white/10"
          >
            <Link href={pathsConfig.auth.signIn}>Sign in</Link>
          </Button>
        </div>
        <p className="mt-4 text-sm text-violet-200/70">
          14-day trial on your first paid workspace · Annual plans save ~2 months
        </p>
      </section>

      <BillingIntervalToggle interval={interval} onChange={setInterval} />

      <PricingSection
        title="Always free"
        subtitle="No card required — upgrade only when you add a paid workspace"
      >
        <div className="mx-auto max-w-md">
          <FreePlanCard />
        </div>
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
                  ? 'bg-[#2A9D8F] text-[#0B132B]'
                  : 'border border-white/15 bg-white/5 text-violet-100 hover:bg-white/10',
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
      </PricingSection>

      <PricingSection
        title="Add-ons"
        subtitle="Optional modules billed separately per workspace (after your workspace exists)"
      >
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {MARKETING_ADDON_PLANS.map((plan) => (
            <AddonPlanCard key={plan.productId} plan={plan} />
          ))}
        </div>
      </PricingSection>

      <section className="rounded-2xl border border-white/10 bg-white/5 px-6 py-10 text-center backdrop-blur-sm">
        <h2 className="text-xl font-semibold text-white">Ready to get organised?</h2>
        <p className="mx-auto mt-2 max-w-lg text-sm text-violet-100/80">
          Create your free account, choose your workspaces, and start a trial when you
          are ready. Invited team members never pay — billing stays with the workspace
          owner.
        </p>
        <Button
          asChild
          className="mt-6 h-11 rounded-full bg-[#2A9D8F] px-6 text-[#0B132B] hover:bg-[#238b7f] hover:text-white"
          size="lg"
        >
          <Link href={buildPricingSignupUrl({})}>Create your free account</Link>
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
      <div className="inline-flex rounded-full border border-white/15 bg-white/5 p-1">
        <button
          type="button"
          onClick={() => props.onChange('month')}
          className={cn(
            'rounded-full px-4 py-2 text-sm font-medium transition',
            props.interval === 'month'
              ? 'bg-white text-[#0B132B]'
              : 'text-violet-100 hover:text-white',
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
              ? 'bg-white text-[#0B132B]'
              : 'text-violet-100 hover:text-white',
          )}
        >
          Annual
          <span className="ml-1.5 text-xs text-[#2A9D8F]">Save ~17%</span>
        </button>
      </div>
    </div>
  );
}

function FreePlanCard() {
  return (
    <article className="flex h-full flex-col rounded-2xl border border-white/10 bg-[#0F1B35]/80 p-6 text-white">
      <h3 className="text-lg font-semibold">{MARKETING_FREE_TIER.name}</h3>
      <p className="mt-1 text-sm text-violet-100/75">{MARKETING_FREE_TIER.description}</p>
      <p className="mt-4 text-3xl font-bold tracking-tight">Free</p>
      <FeatureList features={[...MARKETING_FREE_TIER.features]} />
      <div className="mt-6">
        <Button
          asChild
          className="w-full rounded-full border-white/20 bg-white/10 text-white hover:bg-white/15"
          variant="outline"
        >
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
        'relative flex h-full flex-col rounded-2xl border p-6 text-white',
        plan.highlighted
          ? 'border-[#2A9D8F] bg-[#0F1B35] shadow-[0_0_0_1px_rgba(42,157,143,0.35)]'
          : 'border-white/10 bg-[#0F1B35]/80',
      )}
    >
      {plan.badge ? (
        <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-[#2A9D8F] px-3 py-0.5 text-xs font-semibold text-[#0B132B]">
          {plan.badge}
        </span>
      ) : null}
      <h3 className="text-lg font-semibold">{plan.name}</h3>
      <p className="mt-1 text-sm text-violet-100/75">{plan.description}</p>
      <p className="mt-4 text-3xl font-bold tracking-tight">
        {formatGbp(price)}
        <span className="text-base font-normal text-violet-100/70">
          {interval === 'year' ? '/yr' : '/mo'}
        </span>
      </p>
      {interval === 'year' ? (
        <p className="mt-1 text-xs text-[#2A9D8F]">
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
              ? 'bg-[#2A9D8F] text-[#0B132B] hover:bg-[#238b7f] hover:text-white'
              : 'border-white/20 bg-white/10 text-white hover:bg-white/15',
          )}
          variant={plan.highlighted ? 'default' : 'outline'}
        >
          <Link href={signupUrl}>
            Start 14-day trial
            <ArrowRight className="ml-1.5 h-4 w-4" />
          </Link>
        </Button>
        <p className="text-center text-xs text-violet-200/60">
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
    <article className="flex h-full flex-col rounded-2xl border border-white/10 bg-[#0F1B35]/60 p-6 text-white">
      <h3 className="text-lg font-semibold">{plan.name}</h3>
      <p className="mt-1 text-sm text-violet-100/75">{plan.description}</p>
      <p className="mt-4 text-2xl font-bold tracking-tight">
        {formatGbp(plan.monthlyPriceGbp)}
        <span className="text-base font-normal text-violet-100/70">/mo</span>
      </p>
      <FeatureList features={plan.features} compact />
      <div className="mt-6">
        <Button
          asChild
          className="w-full rounded-full border-white/20 bg-white/10 text-white hover:bg-white/15"
          variant="outline"
        >
          <Link href={buildPricingSignupUrl({})}>Get started free</Link>
        </Button>
        <p className="mt-2 text-center text-xs text-violet-200/60">
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
          <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#2A9D8F]" />
          <span className="text-violet-50/90">{feature}</span>
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
        <h2 className="text-2xl font-bold tracking-tight text-white">{props.title}</h2>
        <p className="mt-1 text-sm text-violet-100/75">{props.subtitle}</p>
      </div>
      {props.children}
    </section>
  );
}
