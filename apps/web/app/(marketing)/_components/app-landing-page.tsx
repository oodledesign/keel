import Link from 'next/link';

import { ArrowRight } from 'lucide-react';

import { Button } from '@kit/ui/button';

import pathsConfig from '~/config/paths.config';
import {
  buildPricingSignupUrl,
  formatGbp,
} from '~/lib/billing/pricing-marketing';
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
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_bottom,rgba(255,255,255,0.03),transparent_22%)]" />

      <section className="relative mx-auto flex w-full max-w-7xl flex-col gap-14 px-6 pb-16 pt-24 md:pt-28">
        <div className="grid items-center gap-12 lg:grid-cols-[1.05fr,0.95fr]">
          <div className="space-y-8">
            <div className="flex flex-wrap items-center gap-2">
              <span className={marketingEyebrow}>{config.hero.eyebrow}</span>
              <span className={`inline-flex items-center rounded-full border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)]/70 px-3 py-1 text-xs font-medium ${marketingBodyText}`}>
                From {formatGbp(config.fromPriceGbp)}/mo per workspace
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
                  Start with free Business Lite
                  <ArrowRight className="ml-1.5 h-4 w-4" />
                </Link>
              </Button>
              <Button
                asChild
                variant="outline"
                size="lg"
                className={marketingBtnOutline}
              >
                <Link href="/pricing">View pricing</Link>
              </Button>
            </div>
          </div>

          <div className={`relative rounded-3xl p-5 ${marketingPanelDeep}`}>
            <div className="absolute -inset-px rounded-3xl bg-[linear-gradient(135deg,var(--ozer-coral-alpha-15),transparent_58%)] opacity-70" />
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
          </div>
        </div>
      </section>

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
            <Link href={BUSINESS_LITE_SIGNUP}>Get started free</Link>
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
