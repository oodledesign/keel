import Link from 'next/link';

import { ArrowRight, Check } from 'lucide-react';

import { Button } from '@kit/ui/button';
import { cn } from '@kit/ui/utils';

import pathsConfig from '~/config/paths.config';
import {
  buildPricingSignupUrl,
  formatGbp,
} from '~/lib/billing/pricing-marketing';
import { listBillingProductPlanPrices } from '~/lib/billing/billing-config-prices';
import type { AppLandingConfig } from '~/lib/marketing/app-landing-pages';
import {
  marketingBodyText,
  marketingBtnGradient,
  marketingBtnOutline,
  marketingEyebrow,
  marketingFeatureCard,
  marketingHeadlineGradient,
  marketingMutedText,
  marketingPanelDeep,
  marketingPanelInner,
  marketingSectionMuted,
} from '~/lib/marketing/marketing-ui';

import { MarketingFaqsSection } from './marketing-faqs';

type AppLandingPageProps = {
  config: AppLandingConfig;
};

const BUSINESS_LITE_SIGNUP = buildPricingSignupUrl({
  profile: 'work_design',
  productId: 'keel-business-lite',
  planId: 'business-lite-free',
});

export function AppLandingPage({ config }: AppLandingPageProps) {
  const Icon = config.icon;

  return (
    <main className="relative overflow-hidden marketing-shell">
      <section className="relative mx-auto flex w-full max-w-7xl flex-col gap-14 px-6 pb-16 pt-24 md:pt-28">
        <div className="grid items-center gap-12 lg:grid-cols-[1.05fr,0.95fr]">
          <div className="space-y-8">
            <div className="flex flex-wrap items-center gap-2">
              <span className={marketingEyebrow}>{config.hero.eyebrow}</span>
              <span className={`inline-flex items-center rounded-full border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)]/70 px-3 py-1 text-xs font-medium ${marketingBodyText}`}>
                {config.hero.priceBadge ??
                  `From ${formatGbp(config.fromPriceGbp)}/mo`}
              </span>
            </div>

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
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Button asChild size="lg" className={marketingBtnGradient}>
                <Link href={BUSINESS_LITE_SIGNUP}>
                  {config.hero.primaryCtaLabel ?? 'Start with free Business Lite'}
                  <ArrowRight className="ml-1.5 h-4 w-4" />
                </Link>
              </Button>
              {config.hero.secondaryCta ? (
                <Button
                  asChild
                  variant="outline"
                  size="lg"
                  className={marketingBtnOutline}
                >
                  <Link href={config.hero.secondaryCta.href}>
                    {config.hero.secondaryCta.label}
                  </Link>
                </Button>
              ) : (
                <Button
                  asChild
                  variant="outline"
                  size="lg"
                  className={marketingBtnOutline}
                >
                  <Link href="/pricing">See pricing</Link>
                </Button>
              )}
            </div>
          </div>

          <div className={`relative rounded-3xl p-5 ${marketingPanelDeep}`}>
            {config.slug === 'signatures' ? (
              <SignatureHeroMock />
            ) : (
              <div className={`relative space-y-4 p-5 ${marketingPanelInner}`}>
                <div className="flex items-center gap-3">
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-[color:var(--workspace-shell-border)] bg-[var(--ozer-plum-alpha-08)] text-[var(--ozer-accent)]">
                    <Icon className="h-5 w-5" aria-hidden />
                  </span>
                  <div>
                    <p className="font-semibold text-[var(--workspace-shell-text)]">{config.name}</p>
                    <p className={`text-xs ${marketingMutedText}`}>Ozer workspace add-on</p>
                  </div>
                </div>
                <ul className="space-y-3">
                  {config.features.map((feature) => (
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
            )}
          </div>
        </div>
      </section>

      {config.pain ? (
        <section
          className="relative mx-auto w-full max-w-7xl px-6 pb-20"
          aria-labelledby="signature-pain-heading"
        >
          <h2
            id="signature-pain-heading"
            className="font-heading text-3xl font-semibold text-[var(--workspace-shell-text)] md:text-4xl"
          >
            {config.pain.heading}
          </h2>
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {config.pain.cards.map((card) => (
              <article
                key={card.title}
                className={`rounded-2xl border border-[color:var(--workspace-shell-border)] ${marketingFeatureCard} p-6`}
              >
                <h3 className="font-heading text-xl font-semibold text-[var(--workspace-shell-text)]">
                  {card.title}
                </h3>
                <p className={`mt-2 text-sm leading-relaxed ${marketingMutedText}`}>
                  {card.description}
                </p>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      <section
        id="features"
        className="relative mx-auto w-full max-w-7xl px-6 pb-20"
        aria-labelledby="app-features-heading"
      >
        <div className="mb-8 max-w-2xl">
          <h2
            id="app-features-heading"
            className="font-heading text-3xl font-semibold text-[var(--workspace-shell-text)] md:text-4xl"
          >
            What {config.name} includes
          </h2>
          <p className={`mt-3 ${marketingBodyText}`}>
            Install {config.name} on any Ozer business workspace. Business Lite is free — you only pay for the apps you need.
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {config.features.map((feature) => (
            <article
              key={feature.title}
              className={`rounded-2xl border border-[color:var(--workspace-shell-border)] ${marketingFeatureCard} p-6`}
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

      {config.pricing ? (
        <SignaturePricingSection config={config} />
      ) : null}

      <section
        className={`border-y py-20 ${marketingSectionMuted}`}
        aria-labelledby="app-how-heading"
      >
        <div className="mx-auto w-full max-w-7xl px-6">
          <h2
            id="app-how-heading"
            className="font-heading text-3xl font-semibold text-[var(--workspace-shell-text)] md:text-4xl"
          >
            How to get {config.name}
          </h2>
          <ol className="mt-10 grid gap-6 md:grid-cols-3">
            {config.steps.map((step, index) => (
              <li
                key={step.title}
                className={`rounded-2xl border border-[color:var(--workspace-shell-border)] ${marketingFeatureCard} p-6`}
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

      <MarketingFaqsSection
        faqs={config.faqs}
        tone="muted"
        headingId="app-faq-heading"
        sectionClassName="border-t border-[color:var(--workspace-shell-border)] marketing-section-muted"
      />

      <section className="relative mx-auto w-full max-w-7xl px-6 py-20">
        <div className={`rounded-2xl border border-[color:var(--workspace-shell-border)] px-8 py-12 text-center ${marketingFeatureCard}`}>
          <h2 className="font-heading text-3xl font-semibold text-[var(--workspace-shell-text)]">
            Add {config.name} to your workspace
          </h2>
          <p className={`mx-auto mt-3 max-w-xl ${marketingBodyText}`}>
            Create a free Business Lite workspace, then subscribe to {config.name} from billing when you are ready.
          </p>
          <Button
            asChild
            size="lg"
            className="mt-6 rounded-full bg-[var(--ozer-accent)] px-7 text-[var(--ozer-plum-950)] hover:bg-[var(--ozer-accent-hover)] hover:text-[var(--ozer-white)]"
          >
            <Link href={BUSINESS_LITE_SIGNUP}>Start free</Link>
          </Button>
          <p className={`mt-4 text-xs ${marketingMutedText}`}>
            Explore all apps on the{' '}
            <Link href="/apps" className="underline hover:text-[var(--workspace-shell-text)]">
              Ozer apps page
            </Link>
            {' · '}
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

function SignatureHeroMock() {
  return (
    <div className={`relative overflow-hidden p-5 ${marketingPanelInner}`}>
      <div className="rounded-2xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--ozer-coral-600)]">
              Signature template
            </p>
            <p className="mt-1 font-heading text-xl font-semibold text-[var(--workspace-shell-text)]">
              Studio launch campaign
            </p>
          </div>
          <span className="rounded-full bg-[var(--ozer-accent)] px-3 py-1 text-xs font-semibold text-[var(--ozer-plum-950)]">
            Live
          </span>
        </div>

        <div className="mt-5 rounded-xl border border-[color:var(--workspace-shell-border)] bg-[var(--ozer-cream-50)] p-4 text-[var(--ozer-text-on-light)]">
          <div className="flex items-start gap-3">
            <span className="mt-1 h-10 w-10 rounded-xl bg-[var(--ozer-accent)]" />
            <div className="min-w-0 flex-1">
              <p className="font-semibold">Alex Morgan</p>
              <p className="text-sm text-[var(--ozer-text-on-light-muted)]">
                Studio Director · Northline Creative
              </p>
              <p className="mt-2 text-xs text-[var(--ozer-text-on-light-muted)]">
                alex@northline.studio · +44 20 0000 0000
              </p>
            </div>
          </div>
          <div className="mt-4 rounded-lg bg-[var(--ozer-sky-100)] px-3 py-2 text-xs font-semibold text-[var(--ozer-plum-950)]">
            New campaign banner: book your spring brand review
          </div>
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        {['Microsoft 365', 'Google Workspace', 'Whole team'].map((item) => (
          <div
            key={item}
            className="rounded-xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] px-3 py-2 text-center"
          >
            <p className="text-xs font-semibold text-[var(--workspace-shell-text)]">
              {item}
            </p>
            <p className={`mt-1 text-[10px] ${marketingMutedText}`}>Connected</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function SignaturePricingSection({ config }: { config: AppLandingConfig }) {
  if (!config.pricing) return null;

  const pricing = config.pricing;
  const prices = listBillingProductPlanPrices(config.productId);
  const priceByPlanId = new Map(prices.map((plan) => [plan.planId, plan]));
  const setupHref = config.hero.secondaryCta?.href ?? 'mailto:info@ozer.so';

  return (
    <section
      className="relative mx-auto w-full max-w-7xl px-6 pb-20"
      aria-labelledby="signature-pricing-heading"
    >
      <div className="mb-8 max-w-2xl">
        <h2
          id="signature-pricing-heading"
          className="font-heading text-3xl font-semibold text-[var(--workspace-shell-text)] md:text-4xl"
        >
          {pricing.heading}
        </h2>
        <p className={`mt-3 ${marketingBodyText}`}>{pricing.body}</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {pricing.tiers.map((tier) => {
          const monthly = priceByPlanId.get(tier.monthlyPlanId);
          const annual = priceByPlanId.get(tier.annualPlanId);

          return (
            <article
              key={tier.name}
              className={`flex h-full flex-col rounded-2xl border border-[color:var(--workspace-shell-border)] ${marketingFeatureCard} p-6`}
            >
              <p className="text-sm font-semibold uppercase tracking-[0.12em] text-[var(--ozer-coral-600)]">
                {tier.mailboxes}
              </p>
              <h3 className="mt-2 font-heading text-2xl font-semibold text-[var(--workspace-shell-text)]">
                {tier.name}
              </h3>
              <p className="mt-4 text-4xl font-bold tracking-tight text-[var(--workspace-shell-text)]">
                {formatGbp(monthly?.priceGbp ?? 0)}
                <span className={`text-base font-normal ${marketingMutedText}`}>
                  /mo
                </span>
              </p>
              <p className={`mt-1 text-sm ${marketingMutedText}`}>
                or {formatGbp(annual?.priceGbp ?? 0)} per year — 16.7% less than
                monthly
              </p>

              <ul className="mt-5 flex-1 space-y-2">
                {pricing.included.map((feature) => (
                  <li key={feature} className="flex gap-2 text-sm">
                    <Check
                      className="mt-0.5 h-4 w-4 shrink-0 text-[var(--ozer-accent)]"
                      aria-hidden
                    />
                    <span className={marketingBodyText}>{feature}</span>
                  </li>
                ))}
              </ul>

              <Button asChild className={cn('mt-6', marketingBtnGradient)}>
                <Link href={BUSINESS_LITE_SIGNUP}>Start free with Business Lite</Link>
              </Button>
            </article>
          );
        })}
      </div>

      <div className="mt-6 rounded-2xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] p-5 text-center">
        <p className={`text-sm ${marketingBodyText}`}>
          <Link href={setupHref} className="font-semibold underline underline-offset-2">
            {pricing.contactLine}
          </Link>
        </p>
        <p className={`mt-3 text-sm ${marketingMutedText}`}>
          {pricing.comparisonLine}
        </p>
        <p className={`mt-3 text-sm font-medium ${marketingBodyText}`}>
          Your price is locked for as long as you subscribe — founding customers
          keep founding rates.
        </p>
      </div>
    </section>
  );
}
