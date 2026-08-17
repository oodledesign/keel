import Image from 'next/image';
import Link from 'next/link';

import {
  ArrowLeftRight,
  ArrowRight,
  Check,
  ClipboardList,
  FileText,
  ListFilter,
  Mail,
  PenLine,
  Sparkles,
} from 'lucide-react';

import { Button } from '@kit/ui/button';
import { cn } from '@kit/ui/utils';

import pathsConfig from '~/config/paths.config';
import {
  buildPricingSignupUrl,
  formatGbp,
} from '~/lib/billing/pricing-marketing';
import { loadPublicBrochureByToken } from '~/lib/commercial/public-brochure.loader';
import { extractBrochureShareToken } from '~/lib/commercial/public-brochure.shared';
import {
  marketingBodyText,
  marketingBtnGradient,
  marketingBtnOutline,
  marketingBtnOutlineOnDark,
  marketingCardHover,
  marketingEyebrow,
  marketingEyebrowOnDark,
  marketingFeatureCard,
  marketingFeaturedPlan,
  marketingHeadlineGradient,
  marketingMutedText,
  marketingPanelDeep,
  marketingPanelInner,
  marketingSectionDarkMuted,
  marketingSectionHeading,
  marketingSectionMuted,
} from '~/lib/marketing/marketing-ui';
import { getSegmentPricingComparison } from '~/lib/marketing/pricing-comparison';
import type { SegmentLandingConfig } from '~/lib/marketing/segment-landing-pages';

import { BusinessSeatCalculator } from './business-seat-calculator';
import { CommercialBrochurePreview } from './commercial-brochure-preview';
import { CommercialSeatCalculator } from './commercial-seat-calculator';
import { InterconnectedWorkspacesSection } from './interconnected-workspaces-section';
import { MarketingFaqsSection } from './marketing-faqs';
import { PricingComparisonTable } from './pricing-comparison-table';

type SegmentLandingPageProps = {
  config: SegmentLandingConfig;
};

export function SegmentLandingPage({ config }: SegmentLandingPageProps) {
  const isPersonal = config.slug === 'personal';
  const isCommercial = config.slug === 'commercial-property';
  const isWork = config.slug === 'work';
  const usesGraduatedPricing = isCommercial || isWork;
  const primarySignup = buildPricingSignupUrl({
    profile: config.signupProfile,
    productId:
      config.pricingPlans.find((p) => p.highlighted)?.productId ??
      config.pricingPlans.find((p) => p.priceGbp > 0)?.productId,
    planId:
      config.pricingPlans.find((p) => p.highlighted)?.planId ??
      config.pricingPlans.find((p) => p.priceGbp > 0)?.planId,
    seats:
      config.pricingPlans.find((p) => p.highlighted)?.seats ??
      config.pricingPlans.find((p) => p.priceGbp > 0)?.seats,
  });
  const pricingComparison = getSegmentPricingComparison(config.slug);
  const pricingLink = isPersonal || usesGraduatedPricing ? '#pricing' : '/pricing';
  const includedFeatures = config.features.slice(0, 4);

  return (
    <main className="marketing-shell relative overflow-hidden">
      {/* Hero */}
      {isCommercial ? (
        <section className="marketing-section-plum marketing-section-plum-hero -mb-4">
          <div className="relative mx-auto w-full max-w-7xl px-6 pt-24 pb-16 md:pt-28 md:pb-20">
            <div className="grid items-center gap-12 lg:grid-cols-[0.95fr,1.05fr] lg:gap-14">
              <div className="flex flex-col gap-7">
                <span className={marketingEyebrowOnDark}>
                  {config.hero.eyebrow}
                </span>
                <div className="space-y-4">
                  <h1 className="font-heading text-4xl leading-[1.08] font-bold tracking-tight text-[var(--ozer-text-on-dark)] md:text-5xl lg:text-6xl">
                    {config.hero.title}
                    <span
                      className={cn(marketingHeadlineGradient, 'mt-1 block')}
                    >
                      {config.hero.titleAccent}.
                    </span>
                  </h1>
                  <p
                    className={`max-w-xl text-base leading-relaxed md:text-lg ${marketingSectionDarkMuted}`}
                  >
                    {config.hero.subtitle}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-3 pt-1">
                  <Button
                    asChild
                    size="lg"
                    className={cn(
                      marketingBtnGradient,
                      'transition-transform duration-150 ease-out active:scale-[0.97]',
                    )}
                  >
                    <Link href={primarySignup}>
                      Start free
                      <ArrowRight className="ml-1.5 h-4 w-4" />
                    </Link>
                  </Button>
                  <Button
                    asChild
                    variant="outline"
                    size="lg"
                    className={cn(
                      marketingBtnOutlineOnDark,
                      'transition-transform duration-150 ease-out active:scale-[0.97]',
                    )}
                  >
                    <Link href={pricingLink}>See pricing</Link>
                  </Button>
                </div>
              </div>

              <div className="relative overflow-hidden rounded-3xl border border-[color:var(--ozer-border-on-dark-strong)] bg-[var(--ozer-plum-900)] shadow-[0_24px_60px_rgba(0,0,0,0.35)]">
                <Image
                  src="/brand/marketing/commercial-agency-home.jpg"
                  alt="Commercial Property agency home — unactioned enquiries, stock on market, recent disposals, and quick links"
                  width={2880}
                  height={1340}
                  priority
                  className="h-auto w-full object-contain object-left-top"
                  sizes="(max-width: 1024px) 100vw, 52vw"
                />
              </div>
            </div>
          </div>
        </section>
      ) : (
        <section className="relative mx-auto flex w-full max-w-7xl flex-col gap-14 px-6 pt-24 pb-16 md:pt-28">
          <div className="grid items-center gap-12 lg:grid-cols-[1.05fr,0.95fr]">
            <div className="space-y-8">
              <span className={marketingEyebrow}>{config.hero.eyebrow}</span>

              <div className="space-y-5">
                <h1 className="font-heading text-4xl leading-tight font-bold text-[var(--workspace-shell-text)] md:text-5xl lg:text-6xl">
                  {config.hero.title}
                  <span className={marketingHeadlineGradient}>
                    {' '}
                    {config.hero.titleAccent}
                  </span>
                  .
                </h1>
                <p
                  className={`max-w-xl text-base leading-relaxed md:text-lg ${marketingBodyText}`}
                >
                  {config.hero.subtitle}
                </p>
                {isPersonal ? (
                  <ul
                    className={`flex flex-wrap gap-x-5 gap-y-2 text-sm ${marketingBodyText}`}
                  >
                    {['Completely free', 'No credit card', 'No time limit'].map(
                      (label) => (
                        <li
                          key={label}
                          className="inline-flex items-center gap-1.5"
                        >
                          <Check
                            className="h-4 w-4 shrink-0 text-[var(--ozer-accent)]"
                            aria-hidden
                          />
                          <span>{label}</span>
                        </li>
                      ),
                    )}
                  </ul>
                ) : null}
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <Button asChild size="lg" className={marketingBtnGradient}>
                  <Link href={primarySignup}>
                    Start free
                    <ArrowRight className="ml-1.5 h-4 w-4" />
                  </Link>
                </Button>
                <Button
                  asChild
                  variant="outline"
                  size="lg"
                  className={marketingBtnOutline}
                >
                  <Link href={pricingLink}>See pricing</Link>
                </Button>
              </div>
            </div>

            <div className={`relative rounded-3xl p-5 ${marketingPanelDeep}`}>
              <div className={`relative space-y-4 p-5 ${marketingPanelInner}`}>
                <p
                  className={`text-xs tracking-[0.12em] uppercase ${marketingMutedText}`}
                >
                  Included in {config.hero.eyebrow.toLowerCase()}
                </p>
                <ul className="space-y-3">
                  {includedFeatures.map((feature) => (
                    <li
                      key={feature.title}
                      className="flex items-start gap-3 rounded-xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)]/80 px-3 py-3"
                    >
                      <feature.icon className="mt-0.5 h-4 w-4 shrink-0 text-[var(--ozer-accent)]" />
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
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            {config.stats.map((stat) => (
              <div
                key={stat.label}
                className="marketing-feature-card rounded-2xl border border-[color:var(--workspace-shell-border)] px-5 py-4"
              >
                <p className="text-2xl font-semibold text-[var(--workspace-shell-text)]">
                  {stat.value}
                </p>
                <p
                  className={`mt-1 text-xs tracking-[0.1em] uppercase ${marketingMutedText}`}
                >
                  {stat.label}
                </p>
              </div>
            ))}
          </div>
        </section>
      )}

      {!isCommercial ? (
        <InterconnectedWorkspacesSection
          variant={
            config.slug === 'personal'
              ? 'personal'
              : config.slug === 'work'
                ? 'work'
                : 'default'
          }
        />
      ) : null}

      {/* Features */}
      <section
        id="features"
        className={cn(
          'relative pb-20',
          isCommercial
            ? 'z-10 bg-[var(--workspace-shell-bg)] pt-20'
            : 'mx-auto w-full max-w-7xl px-6 pt-4',
        )}
        aria-labelledby="features-heading"
      >
        <div className={cn(isCommercial && 'mx-auto w-full max-w-7xl px-6')}>
          <div
            className={cn(
              'mb-10 max-w-2xl',
              isCommercial && 'mx-auto text-center',
            )}
          >
            <h2
              id="features-heading"
              className={cn(
                marketingSectionHeading,
                'text-[var(--workspace-shell-text)]',
              )}
            >
              {isCommercial
                ? 'Built for the commercial workspace'
                : `Everything you need for ${config.hero.eyebrow.toLowerCase()}`}
            </h2>
            <p className={`mt-3 ${marketingBodyText}`}>
              {config.slug === 'personal'
                ? 'Modules connect through your personal home — tasks, planner, and shortcuts span every workspace you add.'
                : config.slug === 'work'
                  ? 'Your business workspace runs inside your Ozer account — clients, jobs, and invoices link back to one home, not a separate silo.'
                  : 'Everything fee-earners need on one commercial desk: disposals, pipeline, requirements, interest, and publishing.'}
            </p>
          </div>
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {config.features.map((feature) => (
              <article
                key={feature.title}
                className="marketing-feature-card rounded-2xl border border-[color:var(--workspace-shell-border)] p-6"
              >
                <feature.icon
                  className="h-5 w-5 text-[var(--ozer-accent)]"
                  aria-hidden
                />
                <h3 className="font-heading mt-4 text-xl font-semibold text-[var(--workspace-shell-text)]">
                  {feature.title}
                </h3>
                <p
                  className={`mt-2 text-sm leading-relaxed ${marketingMutedText}`}
                >
                  {feature.description}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {isCommercial ? <CommercialSpotlightSections config={config} /> : null}

      {!isCommercial ? (
        <section
          className={cn('border-y py-20', marketingSectionMuted)}
          aria-labelledby="how-it-works-heading"
        >
          <div className="mx-auto w-full max-w-7xl px-6">
            <h2
              id="how-it-works-heading"
              className={cn(
                marketingSectionHeading,
                'text-[var(--workspace-shell-text)]',
              )}
            >
              How it works
            </h2>
            <ol className="mt-10 grid gap-5 md:grid-cols-3 md:gap-6">
              {config.steps.map((step, index) => (
                <li
                  key={step.title}
                  className="marketing-feature-card rounded-2xl border border-[color:var(--workspace-shell-border)] p-6"
                >
                  <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[var(--ozer-accent-subtle)] text-sm font-bold text-[var(--ozer-coral-600)]">
                    {index + 1}
                  </span>
                  <h3 className="mt-4 text-lg font-semibold text-[var(--workspace-shell-text)]">
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
      ) : null}

      {/* Pricing */}
      <section
        id="pricing"
        className="relative mx-auto w-full max-w-7xl px-6 py-20"
        aria-labelledby="pricing-heading"
      >
        <div className="mb-10 text-center">
          <h2
            id="pricing-heading"
            className={cn(
              marketingSectionHeading,
              'text-[var(--workspace-shell-text)]',
            )}
          >
            {isPersonal
              ? 'Completely free for personal & family'
              : isCommercial
                ? 'Commercial Pricing'
                : 'Simple, transparent pricing'}
          </h2>
          <p className={`mx-auto mt-3 max-w-2xl ${marketingBodyText}`}>
            {config.pricingNote}
          </p>
          {isPersonal ? (
            <p className="mx-auto mt-2 max-w-2xl text-sm font-medium text-[var(--ozer-accent-muted)]">
              £0 forever · No credit card · No trial countdown
            </p>
          ) : null}
        </div>

        {isCommercial ? (
          <CommercialPricingGrid plans={config.pricingPlans} />
        ) : isWork ? (
          <BusinessPricingGrid plans={config.pricingPlans} />
        ) : (
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
            {config.pricingPlans.map((plan) => (
              <SegmentPricingPlanCard key={plan.name} plan={plan} />
            ))}
          </div>
        )}

        {pricingComparison ? (
          <PricingComparisonTable
            comparison={pricingComparison}
            className="mt-10"
          />
        ) : null}

        {!usesGraduatedPricing ? (
          <p className={`mt-8 text-center text-sm ${marketingMutedText}`}>
            <Link
              href="/pricing"
              className="underline underline-offset-2 hover:text-[var(--workspace-shell-text)]"
            >
              View full pricing, annual billing, and add-ons
            </Link>
          </p>
        ) : null}
      </section>

      <MarketingFaqsSection
        faqs={config.faqs}
        tone={isCommercial ? 'light' : 'muted'}
        headingId="faq-heading"
        headingAlign={isCommercial ? 'center' : 'start'}
        sectionClassName="marketing-section-muted"
      />

      {/* Related + CTA */}
      <section
        className={cn(
          isCommercial
            ? 'marketing-section-plum py-20'
            : 'relative mx-auto w-full max-w-7xl px-6 py-20',
        )}
      >
        <div
          className={cn(
            isCommercial && 'relative mx-auto w-full max-w-7xl px-6',
          )}
        >
          {!isCommercial && config.relatedSegments.length > 0 ? (
            <>
              <h2 className="font-heading text-2xl font-semibold text-[var(--workspace-shell-text)]">
                More Ozer workspaces — all connected
              </h2>
              <p className={`mt-2 max-w-2xl text-sm ${marketingMutedText}`}>
                Add business, property, or community spaces anytime. Your
                personal home keeps tasks, planner, and shortcuts unified across
                every workspace.
              </p>
              <div className="mt-6 grid gap-4 md:grid-cols-3">
                {config.relatedSegments.map((segment) => {
                  const SegmentIcon = segment.icon;

                  return (
                    <Link
                      key={segment.slug}
                      href={`/${segment.slug}`}
                      className={cn(
                        'rounded-2xl border border-[color:var(--workspace-shell-border)] p-5 transition',
                        marketingFeatureCard,
                        marketingCardHover,
                      )}
                    >
                      <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-[color:var(--workspace-shell-border)] bg-[var(--ozer-plum-alpha-08)] text-[var(--ozer-accent)]">
                        <SegmentIcon className="h-5 w-5" aria-hidden />
                      </span>
                      <p className="mt-4 font-medium text-[var(--workspace-shell-text)]">
                        {segment.label}
                      </p>
                      <p className={`mt-1 text-sm ${marketingMutedText}`}>
                        {segment.description}
                      </p>
                    </Link>
                  );
                })}
              </div>
            </>
          ) : null}

          <div
            className={cn(
              'rounded-2xl px-8 py-12 text-center',
              isCommercial
                ? 'border border-[color:var(--ozer-border-on-dark-strong)] bg-[var(--ozer-plum-900)]'
                : cn(
                    'border border-[color:var(--workspace-shell-border)]',
                    marketingFeatureCard,
                    config.relatedSegments.length > 0 ? 'mt-16' : '',
                  ),
            )}
          >
            <h2
              className={cn(
                marketingSectionHeading,
                isCommercial
                  ? 'text-[var(--ozer-text-on-dark)]'
                  : 'text-[var(--workspace-shell-text)]',
              )}
            >
              {isPersonal
                ? 'Ready for your free Ozer home?'
                : isCommercial
                  ? 'Ready to run the commercial desk on Ozer?'
                  : 'Ready to get organised with Ozer?'}
            </h2>
            <p
              className={cn(
                'mx-auto mt-3 max-w-xl',
                isCommercial ? marketingSectionDarkMuted : marketingBodyText,
              )}
            >
              {isPersonal
                ? 'Personal and family workspaces stay free — no credit card, no subscription, no catch.'
                : isCommercial
                  ? 'Start with Solo or choose seats for the desk. Graduated pricing is public — no quote form.'
                  : 'Join thousands using Ozer as their workspace OS — personal life and work in one account.'}
            </p>
            <Button
              asChild
              size="lg"
              className="mt-6 rounded-full bg-[var(--ozer-accent)] px-7 text-[var(--ozer-plum-950)] hover:bg-[var(--ozer-accent-hover)] hover:text-[var(--ozer-white)]"
            >
              <Link href={primarySignup}>Start free</Link>
            </Button>
            <p
              className={cn(
                'mt-4 text-xs',
                isCommercial ? marketingSectionDarkMuted : marketingMutedText,
              )}
            >
              Already have an account?{' '}
              <Link
                href={pathsConfig.auth.signIn}
                className={cn(
                  'underline',
                  isCommercial
                    ? 'hover:text-[var(--ozer-text-on-dark)]'
                    : 'hover:text-[var(--workspace-shell-text)]',
                )}
              >
                Sign in
              </Link>
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}

function SegmentPricingPlanCard({
  plan,
  compact = false,
  hideCta = false,
}: {
  plan: SegmentLandingConfig['pricingPlans'][number];
  compact?: boolean;
  hideCta?: boolean;
}) {
  const signupUrl = buildPricingSignupUrl({
    profile: plan.signupProfile,
    productId: plan.productId,
    planId: plan.planId,
    seats: plan.seats,
  });
  const unit = plan.priceUnit ?? 'month';
  const unitLabel =
    plan.priceUnitLabel ??
    (unit === 'additional_seat'
      ? '/additional seat after Solo'
      : unit === 'then_band'
        ? 'then'
        : unit === 'seat'
          ? '/seat'
          : '/mo');

  return (
    <article
      className={cn(
        'relative flex flex-col rounded-2xl border',
        compact ? 'min-h-0 flex-1 p-5' : 'h-full p-6',
        plan.highlighted
          ? marketingFeaturedPlan
          : 'marketing-feature-card border-[color:var(--workspace-shell-border)]',
      )}
    >
      {plan.badge ? (
        <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-[var(--ozer-accent)] px-3 py-0.5 text-xs font-semibold text-[var(--ozer-plum-950)]">
          {plan.badge}
        </span>
      ) : null}
      {plan.bandTitle ? (
        <>
          <p className="text-xs font-semibold tracking-[0.14em] text-[var(--ozer-coral-600)] uppercase">
            {plan.bandTitle}
          </p>
          <h3 className="mt-2 text-lg font-semibold text-[var(--workspace-shell-text)]">
            {plan.name}
          </h3>
        </>
      ) : (
        <h3 className="text-lg font-semibold text-[var(--workspace-shell-text)]">
          {plan.name}
        </h3>
      )}
      <p className={`mt-1 text-sm ${marketingMutedText}`}>{plan.description}</p>
      <p className="mt-4 text-3xl font-bold tracking-tight text-[var(--workspace-shell-text)]">
        {plan.priceGbp === 0 ? (
          'Free'
        ) : unit === 'then_band' ? (
          <>
            <span
              className={`mr-2 text-base font-medium ${marketingMutedText}`}
            >
              then
            </span>
            {formatGbp(plan.priceGbp)}
            <span
              className={cn(
                'mt-1 block text-sm font-normal',
                marketingMutedText,
              )}
            >
              {unitLabel}
            </span>
          </>
        ) : (
          <>
            {formatGbp(plan.priceGbp)}
            <span className={`text-base font-normal ${marketingMutedText}`}>
              {unitLabel}
            </span>
          </>
        )}
      </p>
      {plan.priceExample ? (
        <p className={`mt-2 text-sm leading-snug ${marketingBodyText}`}>
          {plan.priceExample}
        </p>
      ) : null}
      {plan.priceCaption ? (
        <p className={`mt-1 text-xs ${marketingMutedText}`}>
          {plan.priceCaption}
        </p>
      ) : null}
      <ul className={cn('mt-4 space-y-2', compact && 'mt-3')}>
        {plan.features.map((feature) => (
          <li key={feature} className="flex gap-2 text-sm">
            <Check
              className="mt-0.5 h-4 w-4 shrink-0 text-[var(--ozer-accent)]"
              aria-hidden
            />
            <span className={marketingBodyText}>{feature}</span>
          </li>
        ))}
      </ul>
      {!hideCta ? (
        <div className="mt-auto pt-6">
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
            <Link href={signupUrl}>Start free</Link>
          </Button>
        </div>
      ) : (
        <div className="mt-auto pt-4" />
      )}
    </article>
  );
}

function BusinessPricingGrid({
  plans,
}: {
  plans: SegmentLandingConfig['pricingPlans'];
}) {
  const lite = plans.find((plan) => plan.productId === 'ozer-business-lite');
  const ordered = (['solo', 'team', 'scale'] as const)
    .map((id) => plans.find((plan) => plan.id === id))
    .filter((plan): plan is NonNullable<typeof plan> => Boolean(plan));

  const bandPlans = ordered.length > 0 ? ordered : plans.filter((p) => p.id);

  return (
    <div className="space-y-8">
      {lite ? (
        <div className="mx-auto max-w-md">
          <SegmentPricingPlanCard plan={lite} />
        </div>
      ) : null}
      <div className="grid gap-6 lg:grid-cols-3 lg:items-stretch">
        {bandPlans.map((plan) => (
          <SegmentPricingPlanCard
            key={plan.id ?? plan.name}
            plan={plan}
            hideCta
          />
        ))}
      </div>

      <BusinessSeatCalculator />
    </div>
  );
}

function CommercialPricingGrid({
  plans,
}: {
  plans: SegmentLandingConfig['pricingPlans'];
}) {
  const ordered = (['solo', 'team', 'scale'] as const)
    .map((id) => plans.find((plan) => plan.id === id))
    .filter((plan): plan is NonNullable<typeof plan> => Boolean(plan));

  const displayPlans = ordered.length > 0 ? ordered : plans;

  return (
    <div className="space-y-8">
      <div className="grid gap-6 lg:grid-cols-3 lg:items-stretch">
        {displayPlans.map((plan) => (
          <SegmentPricingPlanCard
            key={plan.id ?? plan.name}
            plan={plan}
            hideCta
          />
        ))}
      </div>

      <CommercialSeatCalculator />
    </div>
  );
}

const COMMERCIAL_AI_USES = [
  {
    icon: PenLine,
    title: 'Marketing copy',
    description:
      'First-pass disposal wording from the listing — headline, summary, and particulars.',
  },
  {
    icon: ClipboardList,
    title: 'Requirement drafts',
    description:
      'Turn an enquiry or pasted email into a structured brief, ready to review.',
  },
  {
    icon: ArrowLeftRight,
    title: 'Match explanations',
    description:
      'Why a requirement fits a disposal, in plain English, on the interest schedule.',
  },
  {
    icon: ListFilter,
    title: 'Interest triage',
    description:
      'Suggested add, skip, or review on each pair so the desk works the shortlist first.',
  },
  {
    icon: Mail,
    title: 'Outreach drafts',
    description:
      'A first email to a matched party — edit and send, never auto-published.',
  },
] as const;

async function CommercialSpotlightSections({
  config,
}: {
  config: SegmentLandingConfig;
}) {
  const integrations = config.integrations ?? [];
  const testimonials = config.testimonials ?? [];
  const brochureUrl = config.brochureExampleUrl?.trim();
  const brochureToken = extractBrochureShareToken(brochureUrl);
  let brochureData = null;

  if (brochureToken) {
    try {
      brochureData = await loadPublicBrochureByToken(brochureToken);
    } catch {
      brochureData = null;
    }
  }

  return (
    <>
      {integrations.length > 0 ? (
        <section
          id="integrations"
          className="marketing-section-plum py-20"
          aria-labelledby="integrations-heading"
        >
          <div className="relative mx-auto grid w-full max-w-7xl items-center gap-10 px-6 lg:grid-cols-2 lg:gap-14">
            <div>
              <h2
                id="integrations-heading"
                className={cn(
                  marketingSectionHeading,
                  'text-[var(--ozer-text-on-dark)]',
                )}
              >
                Portals & website sync
              </h2>
              <p className={`mt-4 ${marketingSectionDarkMuted}`}>
                Publish from Commercial Solo — Rightmove, EACH, and Property
                Hive WordPress included. Stock goes out from the same disposal
                record the desk already maintains.
              </p>
            </div>
            <ul className="flex flex-col items-start justify-center gap-8 sm:gap-10 lg:items-end">
              {integrations.map((integration) => (
                <li key={integration.name}>
                  {integration.logoSrc ? (
                    <Image
                      src={integration.logoSrc}
                      alt={`${integration.name} logo`}
                      width={220}
                      height={56}
                      unoptimized
                      className="h-12 w-auto max-w-[14rem] object-contain sm:h-14 sm:max-w-[16rem]"
                    />
                  ) : (
                    <p className="font-heading text-lg font-bold text-[var(--ozer-text-on-dark)]">
                      {integration.name}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          </div>
        </section>
      ) : null}

      <section
        id="pipeline"
        className={cn('border-y py-20', marketingSectionMuted)}
        aria-labelledby="pipeline-heading"
      >
        <div className="mx-auto grid w-full max-w-7xl items-center gap-10 px-6 lg:grid-cols-2">
          <div>
            <span className={marketingEyebrow}>Pipeline</span>
            <h2
              id="pipeline-heading"
              className={cn(
                marketingSectionHeading,
                'mt-4 text-[var(--workspace-shell-text)]',
              )}
            >
              One board for instructions and requirements
            </h2>
            <p className={`mt-4 ${marketingBodyText}`}>
              Drag stages, attach tasks and notes, and keep fee-earners aligned
              without a separate spreadsheet. Requirements sit alongside
              instructions so the desk sees demand and supply together.
            </p>
            <ul className="mt-6 space-y-2">
              {[
                'Instruction and requirement cards on the same pipeline',
                'Stage history and activity for every move',
                'Interest matching between stock and briefs',
              ].map((item) => (
                <li key={item} className="flex gap-2 text-sm">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-[var(--ozer-accent)]" />
                  <span className={marketingBodyText}>{item}</span>
                </li>
              ))}
            </ul>
          </div>
          <div
            className={cn(
              'relative mx-auto aspect-square w-full max-w-md overflow-hidden rounded-3xl border border-[color:var(--workspace-shell-border)] lg:mx-0 lg:max-w-none',
              marketingFeatureCard,
            )}
          >
            <Image
              src="/brand/marketing/commercial-pipeline-wip.png"
              alt="Commercial WIP board with Potential, Current, and Under Offer columns"
              fill
              unoptimized
              className="object-cover object-left-top"
              sizes="(max-width: 1024px) 90vw, 32rem"
            />
          </div>
        </div>
      </section>

      <section
        id="insights"
        className="py-20"
        aria-labelledby="insights-heading"
      >
        <div className="mx-auto grid w-full max-w-7xl items-center gap-10 px-6 lg:grid-cols-2 lg:gap-14">
          <div
            className={cn(
              'relative order-2 overflow-hidden rounded-3xl border border-[color:var(--workspace-shell-border)] lg:order-1',
              marketingFeatureCard,
            )}
          >
            <Image
              src="/brand/marketing/commercial-agency-insights.png"
              alt="Agency Insights — disposals metrics, size bands, and status breakdown for the last quarter"
              width={1024}
              height={529}
              unoptimized
              className="h-auto w-full object-contain object-top"
              sizes="(max-width: 1024px) 90vw, 36rem"
            />
          </div>
          <div className="order-1 lg:order-2">
            <span className={marketingEyebrow}>Insights</span>
            <h2
              id="insights-heading"
              className={cn(
                marketingSectionHeading,
                'mt-4 text-[var(--workspace-shell-text)]',
              )}
            >
              Agency insights, period by period
            </h2>
            <p className={`mt-4 ${marketingBodyText}`}>
              See how the desk performed — new instructions, size on market,
              average days to let or sell, and status mix — with comparison to
              the previous period.
            </p>
            <ul className="mt-6 space-y-2">
              {[
                'Disposals, viewings, requirements, and inbound in one place',
                'Lettings and sales overviews with period comparison',
                'Size bands and status breakdowns for board updates',
              ].map((item) => (
                <li key={item} className="flex gap-2 text-sm">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-[var(--ozer-accent)]" />
                  <span className={marketingBodyText}>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section
        id="ai-writing"
        className="marketing-section-plum py-20"
        aria-labelledby="ai-writing-heading"
      >
        <div className="relative mx-auto w-full max-w-7xl px-6">
          <div className="max-w-3xl">
            <span className={marketingEyebrowOnDark}>
              <Sparkles className="mr-1.5 h-3.5 w-3.5" aria-hidden />
              AI
            </span>
            <h2
              id="ai-writing-heading"
              className={cn(
                marketingSectionHeading,
                'mt-4 text-[var(--ozer-text-on-dark)]',
              )}
            >
              AI that speeds up the desk
            </h2>
            <p className={`mt-4 ${marketingSectionDarkMuted}`}>
              Use AI where commercial desks lose time — writing, matching, and
              first-touch outreach. Every draft stays reviewable. Nothing
              publishes or emails until you say so.
            </p>
          </div>
          <ul className="mt-10 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {COMMERCIAL_AI_USES.map((item) => (
              <li key={item.title} className="min-w-0">
                <article className="flex h-full flex-col gap-3 rounded-2xl border border-[color:var(--ozer-border-on-dark)] bg-[var(--ozer-on-dark-alpha-08)] p-4">
                  <item.icon
                    className="h-5 w-5 shrink-0 text-[var(--ozer-accent)]"
                    aria-hidden
                  />
                  <div>
                    <p className="font-heading text-base font-semibold text-[var(--ozer-text-on-dark)]">
                      {item.title}
                    </p>
                    <p className="mt-1 text-sm leading-relaxed text-[var(--ozer-text-on-dark-muted)]">
                      {item.description}
                    </p>
                  </div>
                </article>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section
        id="brochures"
        className={cn('border-y py-20', marketingSectionMuted)}
        aria-labelledby="brochures-heading"
      >
        <div className="mx-auto grid w-full max-w-7xl items-center gap-10 px-6 lg:grid-cols-2">
          <div>
            <h2
              id="brochures-heading"
              className={cn(
                marketingSectionHeading,
                'text-[var(--workspace-shell-text)]',
              )}
            >
              Online brochures & branded presentations
            </h2>
            <p className={`mt-4 ${marketingBodyText}`}>
              Share a branded slideshow for each disposal — photos, key facts,
              floorplans, location, and an enquire form — instead of emailing
              another static PDF. Agency colours and logo come through
              automatically.
            </p>
            <ul className="mt-6 space-y-2">
              {[
                'Shareable brochure link for landlords and enquirees',
                'Brand colours and logo on the deck',
                'Enquire form wired back to the acting agents',
              ].map((item) => (
                <li key={item} className="flex gap-2 text-sm">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-[var(--ozer-accent)]" />
                  <span className={marketingBodyText}>{item}</span>
                </li>
              ))}
            </ul>
            {brochureUrl ? (
              <div className="mt-6">
                <Button asChild className={marketingBtnGradient}>
                  <Link href={brochureUrl} target="_blank" rel="noreferrer">
                    View live version
                    <ArrowRight className="ml-1.5 h-4 w-4" />
                  </Link>
                </Button>
              </div>
            ) : null}
          </div>
          {brochureUrl ? (
            <CommercialBrochurePreview data={brochureData} />
          ) : (
            <div
              className={cn(
                'rounded-3xl border border-[color:var(--workspace-shell-border)] p-6',
                marketingFeatureCard,
              )}
            >
              <div className="flex items-center gap-2 text-sm font-medium text-[var(--workspace-shell-text)]">
                <FileText className="h-4 w-4 text-[var(--ozer-accent)]" />
                Brochure preview
              </div>
              <p className={`mt-4 text-sm ${marketingMutedText}`}>
                Add a public brochure URL to show an interactive preview here.
              </p>
            </div>
          )}
        </div>
      </section>

      {testimonials.length > 0 ? (
        <section
          id="testimonials"
          className="marketing-section-plum py-20"
          aria-labelledby="testimonials-heading"
        >
          <div className="relative mx-auto w-full max-w-7xl px-6">
            <div className="mx-auto mb-10 max-w-2xl text-center">
              <h2
                id="testimonials-heading"
                className={cn(
                  marketingSectionHeading,
                  'text-[var(--ozer-text-on-dark)]',
                )}
              >
                What agencies say
              </h2>
              <p className={`mt-3 text-sm ${marketingSectionDarkMuted}`}>
                Sample quotes for layout — these are fabricated placeholders,
                not real customer testimonials.
              </p>
            </div>
            <div className="grid gap-5 md:grid-cols-3">
              {testimonials.map((item) => (
                <blockquote
                  key={`${item.name}-${item.firm}`}
                  className="marketing-feature-card rounded-2xl border border-[color:var(--workspace-shell-border)] p-6"
                >
                  <p className={`text-sm leading-relaxed ${marketingBodyText}`}>
                    “{item.quote}”
                  </p>
                  <footer className="mt-5">
                    <p className="text-sm font-semibold text-[var(--workspace-shell-text)]">
                      {item.name}
                    </p>
                    <p className={`text-xs ${marketingMutedText}`}>
                      {item.role}, {item.firm}
                    </p>
                  </footer>
                </blockquote>
              ))}
            </div>
          </div>
        </section>
      ) : null}
    </>
  );
}
