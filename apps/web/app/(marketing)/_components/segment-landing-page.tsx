import Link from 'next/link';

import { ArrowRight, Check } from 'lucide-react';

import { Button } from '@kit/ui/button';
import { cn } from '@kit/ui/utils';

import pathsConfig from '~/config/paths.config';
import {
  buildPricingSignupUrl,
  formatGbp,
} from '~/lib/billing/pricing-marketing';
import { getSegmentPricingComparison } from '~/lib/marketing/pricing-comparison';
import type { SegmentLandingConfig } from '~/lib/marketing/segment-landing-pages';
import { marketingBtnGradient, marketingBtnOutline, marketingBodyText, marketingCardHover, marketingEyebrow, marketingFeatureCard, marketingFeaturedPlan, marketingHeadlineGradient, marketingMutedText, marketingPanelDeep, marketingPanelInner, marketingSectionMuted } from '~/lib/marketing/marketing-ui';

import { PricingComparisonTable } from './pricing-comparison-table';
import { InterconnectedWorkspacesSection } from './interconnected-workspaces-section';
import { MarketingFaqsSection } from './marketing-faqs';

type SegmentLandingPageProps = {
  config: SegmentLandingConfig;
};

export function SegmentLandingPage({ config }: SegmentLandingPageProps) {
  const isPersonal = config.slug === 'personal';
  const primarySignup = buildPricingSignupUrl({
    profile: config.signupProfile,
    productId: config.pricingPlans.find((p) => p.highlighted)?.productId ??
      config.pricingPlans.find((p) => p.priceGbp > 0)?.productId,
    planId: config.pricingPlans.find((p) => p.highlighted)?.planId ??
      config.pricingPlans.find((p) => p.priceGbp > 0)?.planId,
  });
  const pricingComparison = getSegmentPricingComparison(config.slug);

  return (
    <main className="relative overflow-hidden marketing-shell">
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_bottom,rgba(255,255,255,0.03),transparent_22%)]" />

      {/* Hero */}
      <section className="relative mx-auto flex w-full max-w-7xl flex-col gap-14 px-6 pb-16 pt-24 md:pt-28">
        <div className="grid items-center gap-12 lg:grid-cols-[1.05fr,0.95fr]">
          <div className="space-y-8">
            <span className={marketingEyebrow}>{config.hero.eyebrow}</span>

            <div className="space-y-5">
              <h1 className="font-heading text-4xl font-bold leading-tight text-[var(--workspace-shell-text)] md:text-5xl lg:text-6xl">
                {config.hero.title}
                <span className={marketingHeadlineGradient}>
                  {' '}
                  {config.hero.titleAccent}
                </span>
                .
              </h1>
              <p className={`max-w-xl text-base leading-relaxed md:text-lg ${marketingBodyText}`}>
                {config.hero.subtitle}
              </p>
              {isPersonal ? (
                <ul className={`flex flex-wrap gap-x-5 gap-y-2 text-sm ${marketingBodyText}`}>
                  {[
                    'Completely free',
                    'No credit card',
                    'No time limit',
                  ].map((label) => (
                    <li key={label} className="inline-flex items-center gap-1.5">
                      <Check
                        className="h-4 w-4 shrink-0 text-[var(--ozer-accent)]"
                        aria-hidden
                      />
                      <span>{label}</span>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Button asChild size="lg" className={marketingBtnGradient}>
                <Link href={primarySignup}>
                  {isPersonal ? 'Get free access' : 'Start 14-day trial'}
                  <ArrowRight className="ml-1.5 h-4 w-4" />
                </Link>
              </Button>
              <Button
                asChild
                variant="outline"
                size="lg"
                className={marketingBtnOutline}
              >
                <Link href={isPersonal ? '#pricing' : '/pricing'}>
                  {isPersonal ? 'See what’s included free' : 'Compare all pricing'}
                </Link>
              </Button>
            </div>
          </div>

          <div className={`relative rounded-3xl p-5 ${marketingPanelDeep}`}>
            <div className="absolute -inset-px rounded-3xl bg-[linear-gradient(135deg,var(--ozer-coral-alpha-15),transparent_58%)] opacity-70" />
            <div className={`relative space-y-4 p-5 ${marketingPanelInner}`}>
              <p className={`text-xs uppercase tracking-[0.12em] ${marketingMutedText}`}>
                Included in {config.hero.eyebrow.toLowerCase()}
              </p>
              <ul className="space-y-3">
                {config.features.slice(0, 4).map((feature) => (
                  <li
                    key={feature.title}
                    className="flex items-start gap-3 rounded-xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)]/80 px-3 py-3"
                  >
                    <feature.icon className="mt-0.5 h-4 w-4 shrink-0 text-[var(--ozer-accent)]" />
                    <div>
                      <p className="text-sm font-medium text-[var(--workspace-shell-text)]">{feature.title}</p>
                      <p className={`mt-0.5 text-xs leading-relaxed ${marketingMutedText}`}>
                        {feature.description}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          {config.stats.map((stat) => (
            <div
              key={stat.label}
              className="rounded-2xl border border-[color:var(--workspace-shell-border)] marketing-feature-card px-5 py-4 backdrop-blur"
            >
              <p className="text-2xl font-semibold text-[var(--workspace-shell-text)]">{stat.value}</p>
              <p className={`mt-1 text-xs uppercase tracking-[0.1em] ${marketingMutedText}`}>
                {stat.label}
              </p>
            </div>
          ))}
        </div>
      </section>

      <InterconnectedWorkspacesSection
        variant={
          config.slug === 'personal'
            ? 'personal'
            : config.slug === 'work'
              ? 'work'
              : 'default'
        }
      />

      {/* Features */}
      <section
        id="features"
        className="relative mx-auto w-full max-w-7xl px-6 pb-20"
        aria-labelledby="features-heading"
      >
        <div className="mb-8 max-w-2xl">
          <h2 id="features-heading" className="font-heading text-3xl font-semibold text-[var(--workspace-shell-text)] md:text-4xl">
            Everything you need for {config.hero.eyebrow.toLowerCase()}
          </h2>
          <p className={`mt-3 ${marketingBodyText}`}>
            {config.slug === 'personal'
              ? 'Modules connect through your personal home — tasks, planner, and shortcuts span every workspace you add.'
              : config.slug === 'work'
                ? 'Your business workspace runs inside your Ozer account — clients, jobs, and invoices link back to one home, not a separate silo.'
                : 'Ozer modules work together — and every workspace stays connected to your personal home for tasks, planning, and shortcuts.'}
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {config.features.map((feature) => (
            <article
              key={feature.title}
              className="rounded-2xl border border-[color:var(--workspace-shell-border)] marketing-feature-card p-6"
            >
              <feature.icon className="h-5 w-5 text-[var(--ozer-accent)]" aria-hidden />
              <h3 className="mt-4 font-heading text-xl font-semibold text-[var(--workspace-shell-text)]">
                {feature.title}
              </h3>
              <p className={`mt-2 text-sm leading-relaxed ${marketingMutedText}`}>
                {feature.description}
              </p>
            </article>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section
        className={cn('border-y py-20', marketingSectionMuted)}
        aria-labelledby="how-it-works-heading"
      >
        <div className="mx-auto w-full max-w-7xl px-6">
          <h2
            id="how-it-works-heading"
            className="font-heading text-3xl font-semibold text-[var(--workspace-shell-text)] md:text-4xl"
          >
            How it works
          </h2>
          <ol className="mt-10 grid gap-6 md:grid-cols-3">
            {config.steps.map((step, index) => (
              <li
                key={step.title}
                className="rounded-2xl border border-[color:var(--workspace-shell-border)] marketing-feature-card p-6"
              >
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[var(--ozer-accent-subtle)] text-sm font-bold text-[var(--ozer-coral-600)]">
                  {index + 1}
                </span>
                <h3 className="mt-4 text-lg font-semibold text-[var(--workspace-shell-text)]">{step.title}</h3>
                <p className={`mt-2 text-sm leading-relaxed ${marketingMutedText}`}>
                  {step.description}
                </p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Pricing */}
      <section
        id="pricing"
        className="relative mx-auto w-full max-w-7xl px-6 py-20"
        aria-labelledby="pricing-heading"
      >
        <div className="mb-10 text-center">
          <h2 id="pricing-heading" className="font-heading text-3xl font-semibold text-[var(--workspace-shell-text)] md:text-4xl">
            {isPersonal
              ? 'Completely free for personal & family'
              : 'Simple, transparent pricing'}
          </h2>
          <p className={`mx-auto mt-3 max-w-2xl ${marketingBodyText}`}>{config.pricingNote}</p>
          {isPersonal ? (
            <p className="mx-auto mt-2 max-w-2xl text-sm font-medium text-[var(--ozer-accent-muted)]">
              £0 forever · No credit card · No trial countdown
            </p>
          ) : null}
        </div>

        <div
          className={cn(
            'grid gap-6',
            config.pricingPlans.length === 1
              ? 'mx-auto max-w-md'
              : config.pricingPlans.length === 2
                ? 'md:grid-cols-2'
                : 'md:grid-cols-2 xl:grid-cols-3',
          )}
        >
          {config.pricingPlans.map((plan) => {
            const signupUrl = buildPricingSignupUrl({
              profile: plan.signupProfile,
              productId: plan.productId,
              planId: plan.planId,
            });

            return (
              <article
                key={plan.name}
                className={cn(
                  'relative flex h-full flex-col rounded-2xl border p-6',
                  plan.highlighted
                    ? marketingFeaturedPlan
                    : 'border-[color:var(--workspace-shell-border)] marketing-feature-card',
                )}
              >
                {plan.badge ? (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-[var(--ozer-accent)] px-3 py-0.5 text-xs font-semibold text-[var(--ozer-plum-950)]">
                    {plan.badge}
                  </span>
                ) : null}
                <h3 className="text-lg font-semibold text-[var(--workspace-shell-text)]">{plan.name}</h3>
                <p className={`mt-1 text-sm ${marketingMutedText}`}>{plan.description}</p>
                <p className="mt-4 text-3xl font-bold tracking-tight text-[var(--workspace-shell-text)]">
                  {plan.priceGbp === 0 ? 'Free' : formatGbp(plan.priceGbp)}
                  {plan.priceGbp > 0 ? (
                    <span className={`text-base font-normal ${marketingMutedText}`}>/mo</span>
                  ) : null}
                </p>
                <ul className="mt-4 space-y-2">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex gap-2 text-sm">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-[var(--ozer-accent)]" />
                      <span className={marketingBodyText}>{feature}</span>
                    </li>
                  ))}
                </ul>
                <div className="mt-6">
                  <Button
                    asChild
                    className={cn(
                      'w-full rounded-full',
                      plan.highlighted
                        ? 'bg-[var(--ozer-accent)] text-[var(--ozer-plum-950)] hover:bg-[var(--ozer-accent-hover)] hover:text-[var(--ozer-white)]'
                        : cn(marketingBtnOutline, 'w-full'),
                    )}
                    variant={plan.highlighted ? 'default' : 'outline'}
                  >
                    <Link href={signupUrl}>
                      {plan.priceGbp === 0
                        ? isPersonal
                          ? 'Get free access'
                          : 'Start free'
                        : 'Start 14-day trial'}
                    </Link>
                  </Button>
                </div>
              </article>
            );
          })}
        </div>

        {pricingComparison ? (
          <PricingComparisonTable
            comparison={pricingComparison}
            className="mt-10"
          />
        ) : null}

        <p className={`mt-8 text-center text-sm ${marketingMutedText}`}>
          <Link href="/pricing" className="underline underline-offset-2 hover:text-[var(--workspace-shell-text)]">
            View full pricing, annual billing, and add-ons
          </Link>
        </p>
      </section>

      <MarketingFaqsSection
        faqs={config.faqs}
        tone="muted"
        headingId="faq-heading"
        sectionClassName="border-t border-[color:var(--workspace-shell-border)] marketing-section-muted"
      />

      {/* Related + CTA */}
      <section className="relative mx-auto w-full max-w-7xl px-6 py-20">
        <h2 className="font-heading text-2xl font-semibold text-[var(--workspace-shell-text)]">
          More Ozer workspaces — all connected
        </h2>
        <p className={`mt-2 max-w-2xl text-sm ${marketingMutedText}`}>
          Add business, property, or community spaces anytime. Your personal home
          keeps tasks, planner, and shortcuts unified across every workspace.
        </p>
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {config.relatedSegments.map((segment) => {
            const SegmentIcon = segment.icon;

            return (
              <Link
                key={segment.slug}
                href={`/${segment.slug}`}
                className={cn('rounded-2xl border border-[color:var(--workspace-shell-border)] p-5 transition', marketingFeatureCard, marketingCardHover)}
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-[color:var(--workspace-shell-border)] bg-[var(--ozer-plum-alpha-08)] text-[var(--ozer-accent)]">
                  <SegmentIcon className="h-5 w-5" aria-hidden />
                </span>
                <p className="mt-4 font-medium text-[var(--workspace-shell-text)]">{segment.label}</p>
                <p className={`mt-1 text-sm ${marketingMutedText}`}>{segment.description}</p>
              </Link>
            );
          })}
        </div>

        <div className={cn('mt-16 rounded-2xl border border-[color:var(--workspace-shell-border)] px-8 py-12 text-center', marketingFeatureCard)}>
          <h2 className="font-heading text-3xl font-semibold text-[var(--workspace-shell-text)]">
            {isPersonal
              ? 'Ready for your free Ozer home?'
              : 'Ready to get organised with Ozer?'}
          </h2>
          <p className={`mx-auto mt-3 max-w-xl ${marketingBodyText}`}>
            {isPersonal
              ? 'Personal and family workspaces stay free — no credit card, no subscription, no catch.'
              : 'Join thousands using Ozer as their workspace OS — personal life and work in one account.'}
          </p>
          <Button
            asChild
            size="lg"
            className="mt-6 rounded-full bg-[var(--ozer-accent)] px-7 text-[var(--ozer-plum-950)] hover:bg-[var(--ozer-accent-hover)] hover:text-[var(--ozer-white)]"
          >
            <Link href={primarySignup}>
              {isPersonal ? 'Get free access' : 'Start your trial'}
            </Link>
          </Button>
          <p className={`mt-4 text-xs ${marketingMutedText}`}>
            Already have an account?{' '}
            <Link href={pathsConfig.auth.signIn} className="underline hover:text-[var(--workspace-shell-text)]">
              Sign in
            </Link>
          </p>
        </div>
      </section>
    </main>
  );
}
