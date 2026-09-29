import Link from 'next/link';

import { ArrowRight } from 'lucide-react';

import { Button } from '@kit/ui/button';
import { cn } from '@kit/ui/utils';

import pathsConfig from '~/config/paths.config';
import { listBillingProductPlanPrices } from '~/lib/billing/billing-config-prices';
import {
  MARKETING_BUSINESS_LITE_SIGNUP_URL,
  formatGbp,
} from '~/lib/billing/pricing-marketing';
import type { AppLandingConfig } from '~/lib/marketing/app-landing-pages';
import {
  marketingBodyText,
  marketingBtnPrimary,
  marketingDisplay,
  marketingFigure,
  marketingLede,
  marketingMutedText,
  marketingPanelDeep,
  marketingPanelInner,
  marketingRadiusMedia,
  marketingRule,
  marketingSectionDark,
  marketingSectionDarkMuted,
  marketingSectionMuted,
  marketingTextLink,
  marketingTextLinkOnDark,
} from '~/lib/marketing/marketing-ui';

import { MarketingFaqsSection } from './marketing-faqs';
import {
  MarketingSectionHeader,
  MarketingSectionIndex,
} from './marketing-section-index';

type AppLandingPageProps = {
  config: AppLandingConfig;
};

export function AppLandingPage({ config }: AppLandingPageProps) {
  const Icon = config.icon;

  return (
    <main className="marketing-shell relative overflow-hidden">
      <section className="relative mx-auto w-full max-w-[88rem] px-6 pt-24 pb-20 md:pt-32">
        <MarketingSectionIndex
          label={config.hero.eyebrow}
          aside={
            <span className="tabular-nums">
              {config.hero.priceBadge ??
                `From ${formatGbp(config.fromPriceGbp)}/mo`}
            </span>
          }
        />
        <div className="mt-10 grid items-start gap-12 lg:grid-cols-12 lg:gap-10">
          <div className="flex flex-col gap-8 lg:col-span-7">
            <h1
              className={cn(
                marketingDisplay,
                'text-[var(--workspace-shell-text)] lg:text-[4.75rem]',
              )}
            >
              {config.hero.title} {config.hero.titleAccent}.
            </h1>
            <p className={cn(marketingLede, marketingBodyText)}>
              {config.hero.subtitle}
            </p>

            <div className="flex flex-wrap items-center gap-x-6 gap-y-4">
              <Button asChild className={marketingBtnPrimary}>
                <Link href={MARKETING_BUSINESS_LITE_SIGNUP_URL}>
                  {config.hero.primaryCtaLabel ??
                    'Start with free Business Lite'}
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
              </Button>
              {config.hero.secondaryCta ? (
                <Link
                  href={config.hero.secondaryCta.href}
                  className={cn(
                    marketingTextLink,
                    'text-[var(--workspace-shell-text)]',
                  )}
                >
                  {config.hero.secondaryCta.label}
                </Link>
              ) : (
                <Link
                  href="/pricing"
                  className={cn(
                    marketingTextLink,
                    'text-[var(--workspace-shell-text)]',
                  )}
                >
                  See pricing
                </Link>
              )}
            </div>
          </div>

          <div className={cn('relative p-4 lg:col-span-5', marketingPanelDeep)}>
            {config.slug === 'signatures' ? (
              <SignatureHeroMock />
            ) : (
              <div className={`relative space-y-4 p-5 ${marketingPanelInner}`}>
                <div className="flex items-center gap-3">
                  <Icon
                    className="h-5 w-5 text-[var(--workspace-shell-text-muted)]"
                    aria-hidden="true"
                  />
                  <div>
                    <p className="font-semibold text-[var(--workspace-shell-text)]">
                      {config.name}
                    </p>
                    <p className={`text-xs ${marketingMutedText}`}>
                      Ozer workspace add-on
                    </p>
                  </div>
                </div>
                <ul className="divide-y divide-[color:var(--workspace-shell-border)]">
                  {config.features.map((feature) => (
                    <li
                      key={feature.title}
                      className="flex items-start gap-3 py-3"
                    >
                      <feature.icon
                        className="mt-0.5 h-4 w-4 shrink-0 text-[var(--workspace-shell-text-muted)]"
                        aria-hidden="true"
                      />
                      <div>
                        <p className="text-sm font-medium text-[var(--workspace-shell-text)]">
                          {feature.title}
                        </p>
                        <p
                          className={`mt-0.5 text-xs leading-relaxed ${marketingMutedText}`}
                        >
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
          className="relative mx-auto w-full max-w-[88rem] px-6 pb-24"
          aria-labelledby="signature-pain-heading"
        >
          <MarketingSectionHeader
            label="The problem"
            title={config.pain.heading}
            headingId="signature-pain-heading"
          />
          <NumberedRuledGrid
            items={config.pain.cards.map((card) => ({
              title: card.title,
              description: card.description,
            }))}
          />
        </section>
      ) : null}

      <section
        id="features"
        className="relative mx-auto w-full max-w-[88rem] px-6 pb-24"
        aria-labelledby="app-features-heading"
      >
        <MarketingSectionHeader
          label="Included"
          title={`What ${config.name} includes`}
          intro={`Install ${config.name} on any Ozer business workspace. Business Lite is free, so you only pay for the apps you use.`}
          headingId="app-features-heading"
        />
        <NumberedRuledGrid
          items={config.features.map((feature) => ({
            title: feature.title,
            description: feature.description,
          }))}
        />
      </section>

      {config.pricing ? <SignaturePricingSection config={config} /> : null}

      <section
        className={`border-y py-24 ${marketingSectionMuted}`}
        aria-labelledby="app-how-heading"
      >
        <div className="mx-auto w-full max-w-[88rem] px-6">
          <MarketingSectionHeader
            label="Setup"
            title={`How to get ${config.name}`}
            headingId="app-how-heading"
          />
          <ol className="mt-12 grid gap-10 md:grid-cols-3">
            {config.steps.map((step, index) => (
              <li
                key={step.title}
                className={cn(marketingRule, 'border-t pt-6')}
              >
                <span
                  className={cn(
                    marketingFigure,
                    'block text-[3.5rem] leading-none text-[var(--workspace-shell-text)]',
                  )}
                  aria-hidden="true"
                >
                  {index + 1}
                </span>
                <h3 className="mt-6 text-lg font-medium text-[var(--workspace-shell-text)]">
                  <span className="sr-only">Step {index + 1}: </span>
                  {step.title}
                </h3>
                <p
                  className={`mt-2 text-sm leading-relaxed ${marketingMutedText}`}
                >
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
        sectionClassName="marketing-section-muted"
      />

      <section
        className={cn(marketingSectionDark, 'py-24 md:py-32')}
        aria-labelledby="app-cta-heading"
      >
        <div className="mx-auto w-full max-w-[88rem] px-6">
          <MarketingSectionIndex label="Get started" tone="dark" />
          <div className="mt-10 grid gap-10 lg:grid-cols-12 lg:items-end">
            <h2
              id="app-cta-heading"
              className={cn(
                marketingDisplay,
                'text-[var(--ozer-text-on-dark)] lg:col-span-8 lg:text-[4.5rem]',
              )}
            >
              Add {config.name} to your workspace.
            </h2>
            <div className="flex flex-col gap-6 lg:col-span-4">
              <p className={cn(marketingLede, marketingSectionDarkMuted)}>
                Create a free Business Lite workspace, then subscribe to{' '}
                {config.name} from billing when you are ready.
              </p>
              <div className="flex flex-wrap items-center gap-x-6 gap-y-4">
                <Button asChild className={marketingBtnPrimary}>
                  <Link href={MARKETING_BUSINESS_LITE_SIGNUP_URL}>
                    Start free
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </Link>
                </Button>
                <Link href="/apps" className={marketingTextLinkOnDark}>
                  All apps
                </Link>
                <Link
                  href={pathsConfig.auth.signIn}
                  className={marketingTextLinkOnDark}
                >
                  Sign in
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

function NumberedRuledGrid({
  items,
}: {
  items: Array<{ title: string; description: string }>;
}) {
  return (
    <ol className="mt-12 grid gap-x-10 gap-y-10 md:grid-cols-2 lg:grid-cols-3">
      {items.map((item, index) => (
        <li key={item.title} className={cn(marketingRule, 'border-t pt-5')}>
          <span className={cn('text-sm tabular-nums', marketingMutedText)}>
            {String(index + 1).padStart(2, '0')}
          </span>
          <h3 className="font-heading mt-3 text-[1.5rem] leading-tight font-medium tracking-[-0.01em] text-[var(--workspace-shell-text)]">
            {item.title}
          </h3>
          <p className={`mt-2 text-sm leading-relaxed ${marketingMutedText}`}>
            {item.description}
          </p>
        </li>
      ))}
    </ol>
  );
}

function SignatureHeroMock() {
  return (
    <div className={`relative overflow-hidden p-5 ${marketingPanelInner}`}>
      <div className="rounded-2xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold tracking-[0.12em] text-[var(--ozer-coral-600)] uppercase">
              Signature template
            </p>
            <p className="font-heading mt-1 text-xl font-semibold text-[var(--workspace-shell-text)]">
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
            <p className={`mt-1 text-[10px] ${marketingMutedText}`}>
              Connected
            </p>
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
      className="relative mx-auto w-full max-w-[88rem] px-6 pb-24"
      aria-labelledby="signature-pricing-heading"
    >
      <MarketingSectionHeader
        label="Pricing"
        title={pricing.heading}
        intro={pricing.body}
        headingId="signature-pricing-heading"
      />

      <div className="mt-12 grid gap-6 lg:grid-cols-3">
        {pricing.tiers.map((tier) => {
          const monthly = priceByPlanId.get(tier.monthlyPlanId);
          const annual = priceByPlanId.get(tier.annualPlanId);

          return (
            <article
              key={tier.name}
              className={cn(
                'flex h-full flex-col border p-6',
                marketingRadiusMedia,
                'border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)]',
              )}
            >
              <p className={cn('text-sm', marketingMutedText)}>
                {tier.mailboxes}
              </p>
              <h3 className="font-heading mt-1 text-[1.75rem] leading-tight font-medium text-[var(--workspace-shell-text)]">
                {tier.name}
              </h3>
              <p
                className={cn(
                  marketingFigure,
                  'mt-6 text-[3rem] leading-none text-[var(--workspace-shell-text)]',
                )}
              >
                {formatGbp(monthly?.priceGbp ?? 0)}
                <span
                  className={cn(
                    'ml-1 font-sans text-base font-normal tracking-normal',
                    marketingMutedText,
                  )}
                >
                  /mo
                </span>
              </p>
              <p className={`mt-2 text-sm ${marketingMutedText}`}>
                or {formatGbp(annual?.priceGbp ?? 0)} per year, 16.7% less than
                monthly
              </p>

              <ul
                className={cn(
                  marketingRule,
                  'mt-6 flex-1 divide-y divide-[color:var(--workspace-shell-border)] border-t text-sm',
                )}
              >
                {pricing.included.map((feature) => (
                  <li key={feature} className={cn('py-2.5', marketingBodyText)}>
                    {feature}
                  </li>
                ))}
              </ul>

              <Button asChild className={cn('mt-6', marketingBtnPrimary)}>
                <Link href={MARKETING_BUSINESS_LITE_SIGNUP_URL}>
                  Start free with Business Lite
                </Link>
              </Button>
            </article>
          );
        })}
      </div>

      <div
        className={cn(
          marketingRule,
          'mt-10 grid gap-3 border-t pt-6 text-sm md:grid-cols-3 md:gap-10',
        )}
      >
        <Link
          href={setupHref}
          className={cn(
            marketingTextLink,
            'text-[var(--workspace-shell-text)]',
          )}
        >
          {pricing.contactLine}
        </Link>
        <p className={marketingMutedText}>{pricing.comparisonLine}</p>
        <p className={marketingBodyText}>
          Your price is locked for as long as you subscribe. Founding customers
          keep founding rates.
        </p>
      </div>
    </section>
  );
}
