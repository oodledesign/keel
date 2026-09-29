import Image from 'next/image';
import Link from 'next/link';

import { ArrowRight, FileText } from 'lucide-react';

import { Button } from '@kit/ui/button';
import { cn } from '@kit/ui/utils';

import pathsConfig from '~/config/paths.config';
import {
  buildPricingSignupUrl,
  formatGbp,
} from '~/lib/billing/pricing-marketing';
import { loadPublicBrochureByToken } from '~/lib/commercial/public-brochure.loader';
import { extractBrochureShareToken } from '~/lib/commercial/public-brochure.shared';
import { COMMERCIAL_HOME_HERO_SCREEN } from '~/lib/marketing/commercial-home-content';
import {
  marketingBodyText,
  marketingBtnOutline,
  marketingBtnPrimary,
  marketingDisplay,
  marketingFeatureCard,
  marketingFeaturedPlan,
  marketingFigure,
  marketingLede,
  marketingMutedText,
  marketingPlanBadge,
  marketingRule,
  marketingRuleOnDark,
  marketingSectionDark,
  marketingSectionDarkMuted,
  marketingSectionHeading,
  marketingSectionMuted,
  marketingTextLink,
  marketingTextLinkOnDark,
} from '~/lib/marketing/marketing-ui';
import { getSegmentPricingComparison } from '~/lib/marketing/pricing-comparison';
import type { SegmentLandingConfig } from '~/lib/marketing/segment-landing-pages';

import { BusinessSeatCalculator } from './business-seat-calculator';
import { ComingSoon } from './coming-soon';
import { CommercialBrochurePreview } from './commercial-brochure-preview';
import { CommercialSeatCalculator } from './commercial-seat-calculator';
import { FeatureTourSection } from './feature-tour-section';
import { InterconnectedWorkspacesSection } from './interconnected-workspaces-section';
import { MarketingFaqsSection } from './marketing-faqs';
import { MarketingScreen } from './marketing-screen';
import {
  MarketingSectionHeader,
  MarketingSectionIndex,
} from './marketing-section-index';
import { PricingComparisonTable } from './pricing-comparison-table';

type SegmentLandingPageProps = {
  config: SegmentLandingConfig;
};

export function SegmentLandingPage({ config }: SegmentLandingPageProps) {
  const isPersonal = config.slug === 'personal';
  const isCommercial = config.slug === 'commercial-property';
  const isWork = config.slug === 'work';
  const usesPlumHero = isCommercial || isWork;
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
  const pricingLink =
    isPersonal || usesGraduatedPricing ? '#pricing' : '/pricing';
  const includedFeatures = config.features.slice(0, 4);

  return (
    <main className="marketing-shell relative overflow-hidden">
      <SegmentHero
        config={config}
        tone={usesPlumHero ? 'dark' : 'light'}
        primarySignup={primarySignup}
        pricingLink={pricingLink}
        includedFeatures={includedFeatures}
        showScreen={isCommercial}
        showStats={!isCommercial}
        showFreeNotes={isPersonal}
      />

      {isPersonal ? (
        <InterconnectedWorkspacesSection variant="personal" />
      ) : null}

      <section
        id="features"
        className="mx-auto w-full max-w-[88rem] px-6 py-20 md:py-28"
        aria-labelledby="features-heading"
      >
        <MarketingSectionHeader
          label="Features"
          headingId="features-heading"
          title={
            isCommercial
              ? 'Built for the commercial desk'
              : `Everything in ${config.hero.eyebrow.toLowerCase()}`
          }
          intro={
            config.slug === 'personal'
              ? 'Modules connect through your personal home, so tasks, the planner and shortcuts span every workspace you add.'
              : config.slug === 'work'
                ? 'Your business workspace runs inside your Ozer account. Clients, jobs and invoices link back to your home rather than a separate silo.'
                : 'What fee-earners use every day: disposals, pipeline, requirements, interest schedules and portal publishing.'
          }
        />
        <ol
          className={cn(
            marketingRule,
            'mt-12 grid border-t md:mt-16 md:grid-cols-2 lg:grid-cols-3',
          )}
        >
          {config.features.map((feature, index) => (
            <li
              key={feature.title}
              className={cn(marketingRule, 'border-b py-8 md:pr-10')}
            >
              <span className="text-[0.8125rem] font-medium text-[var(--workspace-shell-text-muted)] tabular-nums">
                {String(index + 1).padStart(2, '0')}
              </span>
              <h3 className="font-heading mt-3 text-[1.5rem] leading-tight font-medium tracking-[-0.01em] text-[var(--workspace-shell-text)]">
                {feature.title}
              </h3>
              <p
                className={`mt-2 text-[0.9375rem] leading-relaxed ${marketingMutedText}`}
              >
                {feature.description}
              </p>
            </li>
          ))}
        </ol>
      </section>

      {isCommercial ? <CommercialSpotlightSections config={config} /> : null}

      {isWork ? (
        <>
          <InterconnectedWorkspacesSection variant="work" />
          <FeatureTourSection id="tour" />
          <ComingSoon />
        </>
      ) : null}

      {!isCommercial ? (
        <section
          className={cn('border-y py-20 md:py-28', marketingSectionMuted)}
          aria-labelledby="how-it-works-heading"
        >
          <div className="mx-auto w-full max-w-[88rem] px-6">
            <MarketingSectionHeader
              label="How it works"
              title={`${config.steps.length} steps to get going`}
              headingId="how-it-works-heading"
            />
            <ol className="mt-12 grid gap-10 md:mt-16 md:grid-cols-3 md:gap-10">
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
                    className={`mt-2 text-[0.9375rem] leading-relaxed ${marketingMutedText}`}
                  >
                    {step.description}
                  </p>
                </li>
              ))}
            </ol>
          </div>
        </section>
      ) : null}

      <section
        id="pricing"
        className="mx-auto w-full max-w-[88rem] scroll-mt-24 px-6 py-20 md:py-28"
        aria-labelledby="pricing-heading"
      >
        <MarketingSectionHeader
          label="Pricing"
          headingId="pricing-heading"
          title={
            isPersonal
              ? 'Free for personal and family'
              : isCommercial
                ? 'Commercial pricing'
                : 'Published pricing'
          }
          intro={
            <>
              {config.pricingNote}
              {isPersonal ? (
                <span className="mt-2 block text-sm font-medium text-[var(--workspace-shell-text)]">
                  Free forever. No card, no trial countdown.
                </span>
              ) : null}
            </>
          }
          className="mb-12 md:mb-16"
        />

        {isCommercial ? (
          <CommercialPricingGrid plans={config.pricingPlans} />
        ) : isWork ? (
          <BusinessPricingGrid plans={config.pricingPlans} />
        ) : (
          <div
            className={cn(
              'grid gap-6',
              config.pricingPlans.length === 1
                ? 'max-w-md'
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
          <p className="mt-8 text-sm">
            <Link href="/pricing" className={marketingTextLink}>
              Full pricing, annual billing and add-ons
            </Link>
          </p>
        ) : null}
      </section>

      <MarketingFaqsSection
        faqs={config.faqs}
        tone={usesPlumHero ? 'light' : 'muted'}
        headingId="faq-heading"
        sectionClassName="marketing-section-muted"
      />

      {!isCommercial && config.relatedSegments.length > 0 ? (
        <section
          className="mx-auto w-full max-w-[88rem] px-6 py-20 md:py-28"
          aria-labelledby="related-heading"
        >
          <MarketingSectionHeader
            label="Other workspaces"
            title="More Ozer workspaces"
            intro="Add business, property or community spaces whenever you need them. Your personal home keeps tasks, the planner and shortcuts joined up across all of them."
            headingId="related-heading"
          />
          <ul className={cn(marketingRule, 'mt-12 border-b md:mt-16')}>
            {config.relatedSegments.map((segment) => (
              <li key={segment.slug} className={cn(marketingRule, 'border-t')}>
                <Link
                  href={`/${segment.slug}`}
                  className="group grid items-baseline gap-x-8 gap-y-1 py-6 transition-colors duration-200 hover:bg-[var(--ozer-plum-alpha-08)] focus-visible:ring-2 focus-visible:ring-[var(--ozer-accent)] focus-visible:outline-none sm:grid-cols-[minmax(0,5fr)_minmax(0,6fr)_2rem] dark:hover:bg-[var(--ozer-on-dark-alpha-06)]"
                >
                  <span className="font-heading text-[1.625rem] leading-tight font-medium tracking-[-0.015em] text-[var(--workspace-shell-text)] md:text-[2rem]">
                    {segment.label}
                  </span>
                  <span className={`text-[0.9375rem] ${marketingMutedText}`}>
                    {segment.description}
                  </span>
                  <span
                    className="text-right text-[var(--workspace-shell-text)] transition-transform duration-200 group-hover:translate-x-1"
                    aria-hidden="true"
                  >
                    →
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section
        className={cn(
          usesPlumHero ? marketingSectionDark : marketingSectionMuted,
          !usesPlumHero && 'border-t',
        )}
        aria-labelledby="segment-cta-heading"
      >
        <div className="mx-auto w-full max-w-[88rem] px-6 py-20 md:py-28">
          <MarketingSectionIndex
            label="Get started"
            tone={usesPlumHero ? 'dark' : 'light'}
          />
          <h2
            id="segment-cta-heading"
            className={cn(
              marketingDisplay,
              'mt-12 max-w-[16ch] md:mt-16',
              usesPlumHero
                ? 'text-[var(--ozer-text-on-dark)]'
                : 'text-[var(--workspace-shell-text)]',
            )}
          >
            {isPersonal
              ? 'Ready for your free Ozer home?'
              : isCommercial
                ? 'Run the commercial desk on Ozer.'
                : 'Run your studio on Ozer.'}
          </h2>
          <div className="mt-10 grid gap-8 md:mt-14 lg:grid-cols-12 lg:gap-10">
            <p
              className={cn(
                marketingLede,
                'lg:col-span-5',
                usesPlumHero ? marketingSectionDarkMuted : marketingBodyText,
              )}
            >
              {isPersonal
                ? 'Personal and family workspaces are free. No card and no subscription.'
                : isCommercial
                  ? 'Start with Solo or choose seats for the desk. Graduated pricing is public, with no quote form.'
                  : 'Clients, jobs, invoices and your own planner in the same Ozer account.'}
            </p>
            <div className="flex flex-wrap items-center gap-6 lg:col-span-6 lg:col-start-7">
              <Button asChild size="lg" className={marketingBtnPrimary}>
                <Link href={primarySignup}>
                  Start free
                  <ArrowRight className="size-4" aria-hidden="true" />
                </Link>
              </Button>
              <Link
                href={pathsConfig.auth.signIn}
                className={
                  usesPlumHero ? marketingTextLinkOnDark : marketingTextLink
                }
              >
                Sign in
              </Link>
            </div>
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
        'relative flex flex-col rounded-[var(--ozer-radius-media)] border',
        compact ? 'min-h-0 flex-1 p-5' : 'h-full p-6',
        plan.highlighted
          ? marketingFeaturedPlan
          : 'marketing-feature-card border-[color:var(--workspace-shell-border)]',
      )}
    >
      {plan.badge ? (
        <span className={cn(marketingPlanBadge, 'absolute -top-3 left-6')}>
          {plan.badge}
        </span>
      ) : null}
      {plan.bandTitle ? (
        <>
          <p className="text-[0.8125rem] font-medium text-[var(--workspace-shell-text-muted)]">
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
      <p
        className={cn(
          marketingFigure,
          'mt-4 text-[2.5rem] leading-none text-[var(--workspace-shell-text)]',
        )}
      >
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
      <RuledList items={plan.features} className={compact ? 'mt-3' : 'mt-5'} />
      {!hideCta ? (
        <div className="mt-auto pt-6">
          <Button
            asChild
            className={cn(
              'w-full',
              plan.highlighted ? marketingBtnPrimary : marketingBtnOutline,
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
    title: 'Marketing copy',
    description:
      'First-pass disposal wording from the listing: headline, summary and particulars.',
  },
  {
    title: 'Requirement drafts',
    description:
      'Turn an enquiry or pasted email into a structured brief, ready to review.',
  },
  {
    title: 'Match explanations',
    description:
      'Why a requirement fits a disposal, in plain English, on the interest schedule.',
  },
  {
    title: 'Interest triage',
    description:
      'Suggested add, skip or review on each pair, so the desk works the shortlist first.',
  },
  {
    title: 'Outreach drafts',
    description:
      'A first email to a matched party. You edit and send it; nothing goes out on its own.',
  },
] as const;

function RuledList({
  items,
  className,
}: {
  items: readonly string[];
  className?: string;
}) {
  return (
    <ul
      className={cn(
        marketingRule,
        'border-b text-[0.9375rem] leading-snug text-[var(--workspace-shell-text)]',
        className,
      )}
    >
      {items.map((item) => (
        <li key={item} className={cn(marketingRule, 'border-t py-2.5')}>
          {item}
        </li>
      ))}
    </ul>
  );
}

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
          <div className="relative mx-auto grid w-full max-w-[88rem] items-center gap-10 px-6 lg:grid-cols-2 lg:gap-16">
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
              <p
                className={cn(marketingLede, 'mt-4', marketingSectionDarkMuted)}
              >
                Publish from Commercial Solo upwards. Rightmove, EACH and the
                Property Hive WordPress plugin are included, and stock goes out
                from the same disposal record the desk already keeps.
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
        <div className="mx-auto grid w-full max-w-[88rem] items-center gap-10 px-6 lg:grid-cols-2 lg:gap-16">
          <div>
            <MarketingSectionIndex label="Pipeline" />
            <h2
              id="pipeline-heading"
              className={cn(
                marketingSectionHeading,
                'mt-8 text-[var(--workspace-shell-text)]',
              )}
            >
              One board for instructions and requirements
            </h2>
            <p className={cn(marketingLede, 'mt-4', marketingBodyText)}>
              Drag stages, attach tasks and notes, and keep fee-earners aligned
              without a separate spreadsheet. Requirements sit alongside
              instructions so the desk sees demand and supply together.
            </p>
            <RuledList
              className="mt-6"
              items={[
                'Instruction and requirement cards on the same pipeline',
                'Stage history and activity for every move',
                'Interest matching between stock and briefs',
              ]}
            />
          </div>
          <MarketingScreen
            screen={{
              src: '/brand/marketing/commercial-pipeline-board.png',
              alt: 'Commercial WIP board with potential and current instruction columns',
              width: 1140,
              height: 1018,
            }}
            sizes="(min-width: 1024px) 45vw, 100vw"
          />
        </div>
      </section>

      <section
        id="insights"
        className="py-20"
        aria-labelledby="insights-heading"
      >
        <div className="mx-auto grid w-full max-w-[88rem] items-center gap-10 px-6 lg:grid-cols-2 lg:gap-16">
          <MarketingScreen
            screen={{
              src: '/brand/marketing/commercial-agency-insights.png',
              alt: 'Agency Insights showing disposals metrics, size bands and status breakdown for the last quarter',
              width: 1024,
              height: 529,
            }}
            sizes="(min-width: 1024px) 45vw, 100vw"
            className="order-2 lg:order-1"
          />
          <div className="order-1 lg:order-2">
            <MarketingSectionIndex label="Insights" />
            <h2
              id="insights-heading"
              className={cn(
                marketingSectionHeading,
                'mt-8 text-[var(--workspace-shell-text)]',
              )}
            >
              Agency insights, period by period
            </h2>
            <p className={cn(marketingLede, 'mt-4', marketingBodyText)}>
              New instructions, size on the market, average days to let or sell
              and status mix, compared with the previous period.
            </p>
            <RuledList
              className="mt-6"
              items={[
                'Disposals, viewings, requirements and inbound on one screen',
                'Lettings and sales overviews with period comparison',
                'Size bands and status breakdowns for board updates',
              ]}
            />
          </div>
        </div>
      </section>

      <section
        id="ai-writing"
        className="marketing-section-plum py-20"
        aria-labelledby="ai-writing-heading"
      >
        <div className="relative mx-auto w-full max-w-[88rem] px-6">
          <MarketingSectionIndex label="AI" tone="dark" />
          <div className="mt-8 max-w-3xl">
            <h2
              id="ai-writing-heading"
              className={cn(
                marketingSectionHeading,
                'text-[var(--ozer-text-on-dark)]',
              )}
            >
              AI that speeds up the desk
            </h2>
            <p className={cn(marketingLede, 'mt-4', marketingSectionDarkMuted)}>
              AI goes where commercial desks lose time: writing, matching and
              first-touch outreach. Every draft stays reviewable, and nothing is
              published or emailed until you say so.
            </p>
          </div>
          <ol
            className={cn(
              marketingRuleOnDark,
              'mt-12 grid border-t sm:grid-cols-2 lg:grid-cols-5',
            )}
          >
            {COMMERCIAL_AI_USES.map((item, index) => (
              <li
                key={item.title}
                className={cn(
                  marketingRuleOnDark,
                  'min-w-0 border-b py-6 lg:border-b-0 lg:border-l lg:px-5 lg:first:border-l-0 lg:first:pl-0',
                )}
              >
                <span className="text-[0.8125rem] font-medium text-[var(--ozer-text-on-dark-muted)] tabular-nums">
                  {String(index + 1).padStart(2, '0')}
                </span>
                <p className="font-heading mt-3 text-[1.25rem] leading-tight font-medium text-[var(--ozer-text-on-dark)]">
                  {item.title}
                </p>
                <p className="mt-2 text-sm leading-relaxed text-[var(--ozer-text-on-dark-muted)]">
                  {item.description}
                </p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section
        id="brochures"
        className={cn('border-y py-20', marketingSectionMuted)}
        aria-labelledby="brochures-heading"
      >
        <div className="mx-auto grid w-full max-w-[88rem] items-center gap-10 px-6 lg:grid-cols-2 lg:gap-16">
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
            <p className={cn(marketingLede, 'mt-4', marketingBodyText)}>
              Share a branded slideshow for each disposal, with photos, key
              facts, floorplans, location and an enquire form, instead of
              emailing another static PDF. Agency colours and logo come through
              automatically.
            </p>
            <RuledList
              className="mt-6"
              items={[
                'Shareable brochure link for landlords and enquirers',
                'Brand colours and logo on the deck',
                'Enquire form wired back to the acting agents',
              ]}
            />
            {brochureUrl ? (
              <div className="mt-8">
                <Button asChild className={marketingBtnPrimary}>
                  <Link href={brochureUrl} target="_blank" rel="noreferrer">
                    View a live brochure
                    <ArrowRight className="size-4" aria-hidden="true" />
                  </Link>
                </Button>
              </div>
            ) : null}
          </div>
          {brochureUrl ? (
            <CommercialBrochurePreview data={brochureData} />
          ) : (
            <div className={cn('border p-6', marketingFeatureCard)}>
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
          <div className="relative mx-auto w-full max-w-[88rem] px-6">
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
                  className="marketing-feature-card border border-[color:var(--workspace-shell-border)] p-6"
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

function SegmentHero({
  config,
  tone,
  primarySignup,
  pricingLink,
  includedFeatures,
  showScreen,
  showStats,
  showFreeNotes,
}: {
  config: SegmentLandingConfig;
  tone: 'light' | 'dark';
  primarySignup: string;
  pricingLink: string;
  includedFeatures: SegmentLandingConfig['features'];
  showScreen: boolean;
  showStats: boolean;
  showFreeNotes: boolean;
}) {
  const onDark = tone === 'dark';
  const text = onDark
    ? 'text-[var(--ozer-text-on-dark)]'
    : 'text-[var(--workspace-shell-text)]';
  const muted = onDark ? marketingSectionDarkMuted : marketingBodyText;
  const rule = onDark ? marketingRuleOnDark : marketingRule;

  return (
    <section
      className={cn(
        onDark &&
          'marketing-section-plum marketing-section-plum-hero border-b-0',
      )}
      aria-labelledby="segment-hero-heading"
    >
      <div className="mx-auto w-full max-w-[88rem] px-6 pt-10 pb-20 md:pt-14 md:pb-28">
        <MarketingSectionIndex label={config.hero.eyebrow} tone={tone} />

        <h1
          id="segment-hero-heading"
          className={cn(marketingDisplay, 'mt-10 max-w-[18ch] md:mt-14', text)}
        >
          {config.hero.title} {config.hero.titleAccent}.
        </h1>

        <div className="mt-10 grid gap-10 md:mt-12 lg:grid-cols-12">
          <div className="lg:col-span-5">
            <p className={cn(marketingLede, muted)}>{config.hero.subtitle}</p>
            {showFreeNotes ? (
              <p className={cn('mt-4 text-sm', muted)}>
                Free, with no card and no time limit.
              </p>
            ) : null}
            <div className="mt-8 flex flex-wrap items-center gap-6">
              <Button asChild size="lg" className={marketingBtnPrimary}>
                <Link href={primarySignup}>
                  Start free
                  <ArrowRight className="size-4" aria-hidden="true" />
                </Link>
              </Button>
              <Link
                href={pricingLink}
                className={onDark ? marketingTextLinkOnDark : marketingTextLink}
              >
                See pricing
              </Link>
            </div>
          </div>

          {showScreen ? (
            <MarketingScreen
              screen={{ ...COMMERCIAL_HOME_HERO_SCREEN, annotations: [] }}
              tone={tone}
              priority
              sizes="(min-width: 1024px) 58vw, 100vw"
              className="lg:col-span-7 lg:mr-[calc(-1*(max(0px,(100vw_-_88rem)/2)_+_1.5rem))]"
              frameClassName="lg:rounded-r-none lg:border-r-0"
            />
          ) : (
            <div className="lg:col-span-6 lg:col-start-7">
              <p className={cn('text-[0.8125rem] font-medium', muted)}>
                Included
              </p>
              <ul className={cn('mt-3 border-b', rule)}>
                {includedFeatures.map((feature) => (
                  <li
                    key={feature.title}
                    className={cn(
                      'grid gap-1 border-t py-4 sm:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] sm:gap-6',
                      rule,
                    )}
                  >
                    <p className={cn('text-[0.9375rem] font-medium', text)}>
                      {feature.title}
                    </p>
                    <p className={cn('text-sm leading-relaxed', muted)}>
                      {feature.description}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {showStats && config.stats.length > 0 ? (
          <dl
            className={cn('mt-16 grid border-t sm:grid-cols-3 md:mt-20', rule)}
          >
            {config.stats.map((stat) => (
              <div
                key={stat.label}
                className={cn(
                  'border-b py-6 sm:border-b-0 sm:border-l sm:px-6 sm:first:border-l-0 sm:first:pl-0',
                  rule,
                )}
              >
                <dt className={cn('text-[0.8125rem] font-medium', muted)}>
                  {stat.label}
                </dt>
                <dd
                  className={cn(
                    marketingFigure,
                    'mt-2 text-[2.5rem] leading-none md:text-[3rem]',
                    text,
                  )}
                >
                  {stat.value}
                </dd>
              </div>
            ))}
          </dl>
        ) : null}
      </div>
    </section>
  );
}
