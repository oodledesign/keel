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

import { PricingComparisonTable } from './pricing-comparison-table';

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
    <main className="relative overflow-hidden bg-[radial-gradient(circle_at_15%_10%,rgba(42,157,143,0.18),transparent_45%),radial-gradient(circle_at_85%_0%,rgba(37,99,235,0.22),transparent_42%),linear-gradient(180deg,#05050b_0%,#080711_45%,#070612_100%)] text-white">
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_bottom,rgba(255,255,255,0.03),transparent_22%)]" />

      {/* Hero */}
      <section className="relative mx-auto flex w-full max-w-7xl flex-col gap-14 px-6 pb-16 pt-24 md:pt-28">
        <div className="grid items-center gap-12 lg:grid-cols-[1.05fr,0.95fr]">
          <div className="space-y-8">
            <span className="inline-flex items-center rounded-full border border-[#2A9D8F]/30 bg-[#2A9D8F]/10 px-4 py-1.5 text-xs font-medium uppercase tracking-[0.14em] text-[#7ee8d8]">
              {config.hero.eyebrow}
            </span>

            <div className="space-y-5">
              <h1 className="font-heading text-4xl font-bold leading-tight text-white md:text-5xl lg:text-6xl">
                {config.hero.title}
                <span className="bg-gradient-to-r from-[#2A9D8F] via-teal-200 to-[#2563EB] bg-clip-text text-transparent">
                  {' '}
                  {config.hero.titleAccent}
                </span>
                .
              </h1>
              <p className="max-w-xl text-base leading-relaxed text-violet-100/85 md:text-lg">
                {config.hero.subtitle}
              </p>
              {isPersonal ? (
                <p className="inline-flex flex-wrap items-center gap-2 text-sm font-medium text-[#7ee8d8]">
                  <span className="rounded-full border border-[#2A9D8F]/35 bg-[#2A9D8F]/10 px-3 py-1">
                    Completely free
                  </span>
                  <span className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-violet-100/90">
                    No credit card
                  </span>
                  <span className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-violet-100/90">
                    No time limit
                  </span>
                </p>
              ) : null}
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Button
                asChild
                size="lg"
                className="h-11 rounded-full bg-gradient-to-r from-[#2A9D8F] to-[#2563EB] px-6 text-white hover:opacity-95"
              >
                <Link href={primarySignup}>
                  {isPersonal ? 'Get free access' : 'Start 14-day trial'}
                  <ArrowRight className="ml-1.5 h-4 w-4" />
                </Link>
              </Button>
              <Button
                asChild
                variant="outline"
                size="lg"
                className="h-11 rounded-full border-white/20 bg-white/5 px-6 text-white hover:bg-white/10"
              >
                <Link href={isPersonal ? '#pricing' : '/pricing'}>
                  {isPersonal ? 'See what’s included free' : 'Compare all pricing'}
                </Link>
              </Button>
            </div>
          </div>

          <div className="relative rounded-3xl border border-white/10 bg-[#0F1B35]/85 p-5 shadow-[0_30px_100px_rgba(8,20,40,0.55)] backdrop-blur">
            <div className="absolute -inset-px rounded-3xl bg-[linear-gradient(135deg,rgba(42,157,143,0.35),rgba(37,99,235,0.2),transparent_58%)] opacity-70" />
            <div className="relative space-y-4 rounded-2xl border border-white/10 bg-[#0B132B] p-5">
              <p className="text-xs uppercase tracking-[0.12em] text-violet-200/80">
                Included in {config.hero.eyebrow.toLowerCase()}
              </p>
              <ul className="space-y-3">
                {config.features.slice(0, 4).map((feature) => (
                  <li
                    key={feature.title}
                    className="flex items-start gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-3"
                  >
                    <feature.icon className="mt-0.5 h-4 w-4 shrink-0 text-[#2A9D8F]" />
                    <div>
                      <p className="text-sm font-medium text-white">{feature.title}</p>
                      <p className="mt-0.5 text-xs leading-relaxed text-violet-100/75">
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
              className="rounded-2xl border border-white/10 bg-white/[0.03] px-5 py-4 backdrop-blur"
            >
              <p className="text-2xl font-semibold text-white">{stat.value}</p>
              <p className="mt-1 text-xs uppercase tracking-[0.1em] text-violet-200/70">
                {stat.label}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section
        id="features"
        className="relative mx-auto w-full max-w-7xl px-6 pb-20"
        aria-labelledby="features-heading"
      >
        <div className="mb-8 max-w-2xl">
          <h2 id="features-heading" className="font-heading text-3xl font-semibold text-white md:text-4xl">
            Everything you need for {config.hero.eyebrow.toLowerCase()}
          </h2>
          <p className="mt-3 text-violet-100/80">
            Keel modules work together — clients, jobs, documents, and conversations stay linked so you spend less time searching and more time delivering.
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {config.features.map((feature) => (
            <article
              key={feature.title}
              className="rounded-2xl border border-white/10 bg-[linear-gradient(145deg,rgba(15,27,53,0.95),rgba(11,19,43,0.95))] p-6"
            >
              <feature.icon className="h-5 w-5 text-[#2A9D8F]" aria-hidden />
              <h3 className="mt-4 font-heading text-xl font-semibold text-white">
                {feature.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-violet-100/80">
                {feature.description}
              </p>
            </article>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section
        className="border-y border-white/10 bg-[#070610]/80 py-20"
        aria-labelledby="how-it-works-heading"
      >
        <div className="mx-auto w-full max-w-7xl px-6">
          <h2
            id="how-it-works-heading"
            className="font-heading text-3xl font-semibold text-white md:text-4xl"
          >
            How it works
          </h2>
          <ol className="mt-10 grid gap-6 md:grid-cols-3">
            {config.steps.map((step, index) => (
              <li
                key={step.title}
                className="rounded-2xl border border-white/10 bg-white/[0.03] p-6"
              >
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[#2A9D8F]/20 text-sm font-bold text-[#7ee8d8]">
                  {index + 1}
                </span>
                <h3 className="mt-4 text-lg font-semibold text-white">{step.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-violet-100/80">
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
          <h2 id="pricing-heading" className="font-heading text-3xl font-semibold text-white md:text-4xl">
            {isPersonal
              ? 'Completely free for personal & family'
              : 'Simple, transparent pricing'}
          </h2>
          <p className="mx-auto mt-3 max-w-2xl text-violet-100/80">{config.pricingNote}</p>
          {isPersonal ? (
            <p className="mx-auto mt-2 max-w-2xl text-sm font-medium text-[#7ee8d8]">
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
                    ? 'border-[#2A9D8F] bg-[#0F1B35] shadow-[0_0_0_1px_rgba(42,157,143,0.35)]'
                    : 'border-white/10 bg-[#0F1B35]/80',
                )}
              >
                {plan.badge ? (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-[#2A9D8F] px-3 py-0.5 text-xs font-semibold text-[#0B132B]">
                    {plan.badge}
                  </span>
                ) : null}
                <h3 className="text-lg font-semibold text-white">{plan.name}</h3>
                <p className="mt-1 text-sm text-violet-100/75">{plan.description}</p>
                <p className="mt-4 text-3xl font-bold tracking-tight text-white">
                  {plan.priceGbp === 0 ? 'Free' : formatGbp(plan.priceGbp)}
                  {plan.priceGbp > 0 ? (
                    <span className="text-base font-normal text-violet-100/70">/mo</span>
                  ) : null}
                </p>
                <ul className="mt-4 space-y-2">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex gap-2 text-sm">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#2A9D8F]" />
                      <span className="text-violet-50/90">{feature}</span>
                    </li>
                  ))}
                </ul>
                <div className="mt-6">
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

        <p className="mt-8 text-center text-sm text-violet-200/70">
          <Link href="/pricing" className="underline underline-offset-2 hover:text-white">
            View full pricing, annual billing, and add-ons
          </Link>
        </p>
      </section>

      {/* FAQ */}
      <section
        className="border-t border-white/10 bg-[#070610]/80 py-20"
        aria-labelledby="faq-heading"
      >
        <div className="mx-auto w-full max-w-3xl px-6">
          <h2 id="faq-heading" className="font-heading text-3xl font-semibold text-white md:text-4xl">
            Frequently asked questions
          </h2>
          <div className="mt-8 space-y-3">
            {config.faqs.map((faq) => (
              <details
                key={faq.question}
                className="group rounded-xl border border-white/10 bg-white/[0.03] px-5 py-4"
              >
                <summary className="cursor-pointer list-none font-medium text-white marker:content-none [&::-webkit-details-marker]:hidden">
                  <span className="flex items-center justify-between gap-4">
                    {faq.question}
                    <span className="text-violet-300/80 transition group-open:rotate-45">+</span>
                  </span>
                </summary>
                <p className="mt-3 text-sm leading-relaxed text-violet-100/80">{faq.answer}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* Related + CTA */}
      <section className="relative mx-auto w-full max-w-7xl px-6 py-20">
        <h2 className="font-heading text-2xl font-semibold text-white">
          Other Keel workspaces
        </h2>
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {config.relatedSegments.map((segment) => {
            const SegmentIcon = segment.icon;

            return (
              <Link
                key={segment.slug}
                href={`/${segment.slug}`}
                className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 transition hover:border-[#2A9D8F]/40 hover:bg-white/[0.05]"
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-[#2A9D8F]">
                  <SegmentIcon className="h-5 w-5" aria-hidden />
                </span>
                <p className="mt-4 font-medium text-white">{segment.label}</p>
                <p className="mt-1 text-sm text-violet-100/75">{segment.description}</p>
              </Link>
            );
          })}
        </div>

        <div className="mt-16 rounded-2xl border border-white/10 bg-gradient-to-br from-[#0F1B35] to-[#0B132B] px-8 py-12 text-center">
          <h2 className="font-heading text-3xl font-semibold text-white">
            {isPersonal
              ? 'Ready for your free Life CRM?'
              : 'Ready to get organised with Keel?'}
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-violet-100/80">
            {isPersonal
              ? 'Personal and family workspaces stay free — no credit card, no subscription, no catch.'
              : 'Join thousands using Keel as their Life CRM — personal life and work in one account.'}
          </p>
          <Button
            asChild
            size="lg"
            className="mt-6 rounded-full bg-[#2A9D8F] px-7 text-[#0B132B] hover:bg-[#238b7f] hover:text-white"
          >
            <Link href={primarySignup}>
              {isPersonal ? 'Get free access' : 'Start your trial'}
            </Link>
          </Button>
          <p className="mt-4 text-xs text-violet-200/60">
            Already have an account?{' '}
            <Link href={pathsConfig.auth.signIn} className="underline hover:text-white">
              Sign in
            </Link>
          </p>
        </div>
      </section>
    </main>
  );
}
