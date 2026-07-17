'use client';

import { useMemo, useState } from 'react';

import Link from 'next/link';
import { useRouter } from 'next/navigation';

import {
  ArrowLeft,
  ArrowRight,
  Briefcase,
  Check,
  Heart,
  Home,
  Layers,
  PenLine,
  UsersRound,
} from 'lucide-react';

import { Button } from '@kit/ui/button';
import { cn } from '@kit/ui/utils';

import {
  MARKETING_FREE_TIER,
  MARKETING_WORKSPACE_PLANS,
  buildPricingSignupUrl,
  formatGbp,
} from '~/lib/billing/pricing-marketing';
import {
  marketingBodyText,
  marketingBtnGradient,
  marketingBtnOutline,
  marketingEyebrow,
  marketingFeatureCard,
  marketingFeaturedPlan,
  marketingMutedText,
} from '~/lib/marketing/marketing-ui';

type Step = 'personal' | 'workspace' | 'business';

type WorkspaceChoice =
  | 'personal_only'
  | 'business'
  | 'apps'
  | 'family'
  | 'community';

type BusinessTier = 'lite' | 'solo' | 'team' | 'scale';

function planByProductId(productId: string) {
  return MARKETING_WORKSPACE_PLANS.find((plan) => plan.productId === productId);
}

function workspacePriceBadge(productId: string | null): string {
  if (!productId) return 'Free';
  const plan = planByProductId(productId);
  if (!plan || plan.monthlyPriceGbp <= 0) return 'Free';
  return `From ${formatGbp(plan.monthlyPriceGbp)}`;
}

const workspaceOptions: Array<{
  value: WorkspaceChoice;
  title: string;
  description: string;
  icon: typeof Home;
  /** null = free; otherwise lowest monthly product price for that workspace type. */
  priceProductId: string | null;
  emphasized?: boolean;
}> = [
  {
    value: 'personal_only',
    title: 'Just personal for now',
    description: 'Free forever — tasks, people, notes, and planner.',
    icon: Home,
    priceProductId: null,
  },
  {
    value: 'apps',
    title: 'I mainly want an app (e.g. Signatures)',
    description:
      'Free Business Lite — install Signatures and other apps. No CRM or clients.',
    icon: PenLine,
    priceProductId: null,
    emphasized: true,
  },
  {
    value: 'business',
    title: 'Add a business workspace',
    description: 'Clients, projects, and invoices — Solo, Team, or Scale.',
    icon: Briefcase,
    priceProductId: 'ozer-business-solo',
  },
  {
    value: 'family',
    title: 'Add a family workspace',
    description: 'Household tasks, calendar, meals, and shopping — free.',
    icon: Heart,
    priceProductId: null,
  },
  {
    value: 'community',
    title: 'Add a community workspace',
    description: 'Clubs, groups, and shared schedules.',
    icon: UsersRound,
    priceProductId: 'ozer-community',
  },
];

export function StartFlowClient() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('personal');
  const [workspace, setWorkspace] = useState<WorkspaceChoice | null>(null);
  const [businessTier, setBusinessTier] = useState<BusinessTier | null>('solo');

  const solo = planByProductId('ozer-business-solo');
  const team = planByProductId('ozer-business-team');
  const scale = planByProductId('ozer-business-scale');
  const lite = planByProductId('ozer-business-lite');

  const signupHref = useMemo(() => {
    if (workspace === 'personal_only' || workspace === null) {
      return buildPricingSignupUrl({});
    }
    if (workspace === 'apps' || businessTier === 'lite') {
      return buildPricingSignupUrl({
        profile: 'work_design',
        productId: 'ozer-business-lite',
        planId: 'business-lite-free',
      });
    }
    if (workspace === 'family') {
      return buildPricingSignupUrl({ profile: 'family' });
    }
    if (workspace === 'community') {
      return buildPricingSignupUrl({ profile: 'community' });
    }
    if (businessTier === 'team') {
      return buildPricingSignupUrl({
        profile: 'work_design',
        productId: 'ozer-business-team',
        planId: team?.monthlyPlanId ?? 'business-team-monthly',
        interval: 'month',
      });
    }
    if (businessTier === 'scale') {
      return buildPricingSignupUrl({
        profile: 'work_design',
        productId: 'ozer-business-scale',
        planId: scale?.monthlyPlanId ?? 'business-scale-monthly',
        interval: 'month',
      });
    }
    return buildPricingSignupUrl({
      profile: 'work_design',
      productId: 'ozer-business-solo',
      planId: solo?.monthlyPlanId ?? 'business-solo-monthly',
      interval: 'month',
    });
  }, [
    workspace,
    businessTier,
    solo?.monthlyPlanId,
    team?.monthlyPlanId,
    scale?.monthlyPlanId,
  ]);

  const stepIndex = step === 'personal' ? 0 : step === 'workspace' ? 1 : 2;
  const totalSteps = workspace === 'business' || step === 'business' ? 3 : 2;

  return (
    <div className="mx-auto w-full max-w-2xl">
      <div className="mb-8 flex items-center justify-between gap-3">
        <p
          className={cn(
            'text-xs font-medium tracking-[0.14em] uppercase',
            marketingMutedText,
          )}
        >
          Step {Math.min(stepIndex + 1, totalSteps)} of {totalSteps}
        </p>
        <div className="flex gap-1.5">
          {Array.from({ length: totalSteps }).map((_, i) => (
            <span
              key={i}
              className={cn(
                'h-1.5 w-8 rounded-full transition-colors',
                i <= stepIndex
                  ? 'bg-[var(--ozer-accent)]'
                  : 'bg-[color:var(--workspace-shell-border)]',
              )}
            />
          ))}
        </div>
      </div>

      {step === 'personal' ? (
        <section className="space-y-6">
          <div className="space-y-3 text-center">
            <span className={marketingEyebrow}>Start free</span>
            <h1 className="font-heading text-3xl font-bold tracking-tight text-[var(--workspace-shell-text)] md:text-4xl">
              Everyone starts with a free personal account
            </h1>
            <p
              className={cn(
                'mx-auto max-w-lg text-base leading-relaxed',
                marketingBodyText,
              )}
            >
              {MARKETING_FREE_TIER.description} No card required. Extra
              workspaces are optional — you can add one on the next step.
            </p>
          </div>

          <div
            className={cn(
              'rounded-2xl border p-5 md:p-6',
              marketingFeaturedPlan,
            )}
          >
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--ozer-accent-subtle)] text-[var(--ozer-coral-600)]">
                <Home className="h-5 w-5" aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-lg font-semibold text-[var(--workspace-shell-text)]">
                    {MARKETING_FREE_TIER.name}
                  </h2>
                  <span className="rounded-full bg-[var(--ozer-accent)] px-2.5 py-0.5 text-xs font-semibold text-[var(--ozer-plum-950)]">
                    Free forever
                  </span>
                </div>
                <ul className="mt-3 space-y-2">
                  {MARKETING_FREE_TIER.features.map((feature) => (
                    <li
                      key={feature}
                      className="flex items-start gap-2 text-sm text-[var(--workspace-shell-text)]"
                    >
                      <Check
                        className="mt-0.5 h-4 w-4 shrink-0 text-[var(--ozer-accent)]"
                        aria-hidden
                      />
                      {feature}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>

          <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <Button
              type="button"
              size="lg"
              className={marketingBtnGradient}
              onClick={() => setStep('workspace')}
            >
              Continue
              <ArrowRight className="ml-1.5 h-4 w-4" />
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className={marketingBtnOutline}
            >
              <Link href={buildPricingSignupUrl({})}>
                Skip — create personal account
              </Link>
            </Button>
          </div>
          <p className={cn('text-center text-sm', marketingMutedText)}>
            You can add workspaces later from the app anytime.
          </p>
        </section>
      ) : null}

      {step === 'workspace' ? (
        <section className="space-y-6">
          <div className="space-y-3 text-center">
            <h1 className="font-heading text-3xl font-bold tracking-tight text-[var(--workspace-shell-text)] md:text-4xl">
              Want another workspace?
            </h1>
            <p
              className={cn(
                'mx-auto max-w-lg text-base leading-relaxed',
                marketingBodyText,
              )}
            >
              Your personal account is always free. Here for an app like
              Signatures? Choose that path. Or add a full business workspace —
              or start personal-only.
            </p>
          </div>

          <ul className="grid gap-3">
            {workspaceOptions.map((option) => {
              const Icon = option.icon;
              const selected = workspace === option.value;
              const priceLabel = workspacePriceBadge(option.priceProductId);
              return (
                <li key={option.value}>
                  <button
                    type="button"
                    onClick={() => {
                      setWorkspace(option.value);
                      if (option.value === 'apps') {
                        setBusinessTier('lite');
                      }
                    }}
                    className={cn(
                      'flex w-full items-start gap-3 rounded-2xl border p-4 text-left transition-colors',
                      selected
                        ? marketingFeaturedPlan
                        : option.emphasized
                          ? cn(
                              marketingFeatureCard,
                              'border-dashed border-[var(--ozer-accent)]/40 bg-[var(--ozer-accent-subtle)]/40 hover:border-[var(--ozer-accent)]/60',
                            )
                          : cn(
                              marketingFeatureCard,
                              'hover:border-[var(--ozer-accent)]/35',
                            ),
                    )}
                  >
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--ozer-accent-subtle)] text-[var(--ozer-coral-600)]">
                      <Icon className="h-5 w-5" aria-hidden />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-[var(--workspace-shell-text)]">
                          {option.title}
                        </span>
                        <span className="rounded-full bg-[var(--ozer-accent-subtle)] px-2 py-0.5 text-[11px] font-semibold text-[var(--ozer-coral-600)]">
                          {priceLabel}
                        </span>
                        {option.emphasized ? (
                          <span className="rounded-full border border-[var(--ozer-accent)]/30 px-2 py-0.5 text-[11px] font-semibold text-[var(--ozer-coral-600)]">
                            Apps
                          </span>
                        ) : null}
                      </span>
                      <span
                        className={cn('mt-1 block text-sm', marketingMutedText)}
                      >
                        {option.description}
                      </span>
                    </span>
                    <span
                      className={cn(
                        'mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[10px] font-bold',
                        selected
                          ? 'border-[var(--ozer-accent)] bg-[var(--ozer-accent)] text-[var(--ozer-plum-950)]'
                          : 'border-[color:var(--workspace-shell-border)] text-transparent',
                      )}
                      aria-hidden
                    >
                      ✓
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <Button
              type="button"
              variant="ghost"
              className="text-[var(--workspace-shell-text-muted)]"
              onClick={() => setStep('personal')}
            >
              <ArrowLeft className="mr-1.5 h-4 w-4" />
              Back
            </Button>
            <Button
              type="button"
              size="lg"
              className={marketingBtnGradient}
              disabled={!workspace}
              onClick={() => {
                if (workspace === 'business') {
                  setStep('business');
                  return;
                }
                router.push(signupHref);
              }}
            >
              {workspace === 'business' ? (
                <>
                  Choose business plan
                  <ArrowRight className="ml-1.5 h-4 w-4" />
                </>
              ) : (
                <>
                  Create free account
                  <ArrowRight className="ml-1.5 h-4 w-4" />
                </>
              )}
            </Button>
          </div>
        </section>
      ) : null}

      {step === 'business' ? (
        <section className="space-y-6">
          <div className="space-y-3 text-center">
            <h1 className="font-heading text-3xl font-bold tracking-tight text-[var(--workspace-shell-text)] md:text-4xl">
              Pick a business workspace
            </h1>
            <p
              className={cn(
                'mx-auto max-w-lg text-base leading-relaxed',
                marketingBodyText,
              )}
            >
              Personal stays free. Paid plans include a 14-day trial with no
              card required. Lite is free forever if you only need apps like
              Signatures.
            </p>
          </div>

          <ul className="grid gap-3">
            {(
              [
                {
                  value: 'solo' as const,
                  title: solo?.name ?? 'Business Solo',
                  priceLabel:
                    solo != null
                      ? `From ${formatGbp(solo.monthlyPriceGbp)}`
                      : 'From £29',
                  description:
                    solo?.description ??
                    'Full studio stack for one freelancer — 14-day trial.',
                  recommended: true,
                  variant: 'plan' as const,
                },
                {
                  value: 'team' as const,
                  title: team?.name ?? 'Business Team',
                  priceLabel:
                    team != null
                      ? `From ${formatGbp(team.monthlyPriceGbp)}`
                      : 'From £79',
                  description:
                    team?.description ??
                    'Shared clients and projects for up to five people — 14-day trial.',
                  recommended: false,
                  variant: 'plan' as const,
                },
                {
                  value: 'scale' as const,
                  title: scale?.name ?? 'Business Scale',
                  priceLabel:
                    scale != null
                      ? `From ${formatGbp(scale.monthlyPriceGbp)}`
                      : 'From £149',
                  description:
                    'Larger teams — up to 15 seats and priority support. Need more? Request extra users anytime.',
                  recommended: false,
                  variant: 'plan' as const,
                },
                {
                  value: 'lite' as const,
                  title: lite?.name ?? 'Business Lite',
                  priceLabel: 'Free',
                  description:
                    'Apps only — Signatures and marketplace add-ons. No clients, jobs, or invoices.',
                  recommended: false,
                  variant: 'apps' as const,
                },
              ] as const
            ).map((option) => {
              const selected = businessTier === option.value;
              const isApps = option.variant === 'apps';
              return (
                <li key={option.value}>
                  <button
                    type="button"
                    onClick={() => setBusinessTier(option.value)}
                    className={cn(
                      'flex w-full items-start gap-3 rounded-2xl border p-4 text-left transition-colors',
                      selected && !isApps && marketingFeaturedPlan,
                      selected &&
                        isApps &&
                        'border-[var(--ozer-info)] bg-[var(--workspace-shell-panel)] shadow-[0_0_0_1px_color-mix(in_srgb,var(--ozer-info)_40%,transparent)]',
                      !selected &&
                        isApps &&
                        cn(
                          marketingFeatureCard,
                          'border-dashed border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-canvas)]/80 hover:border-[var(--ozer-info)]/45',
                        ),
                      !selected &&
                        !isApps &&
                        cn(
                          marketingFeatureCard,
                          'hover:border-[var(--ozer-accent)]/35',
                        ),
                    )}
                  >
                    {isApps ? (
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-dashed border-[var(--ozer-info)]/35 bg-[color-mix(in_srgb,var(--ozer-info)_10%,transparent)] text-[var(--ozer-info)]">
                        <Layers className="h-5 w-5" aria-hidden />
                      </span>
                    ) : null}
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-[var(--workspace-shell-text)]">
                          {option.title}
                        </span>
                        <span
                          className={cn(
                            'rounded-full px-2 py-0.5 text-[11px] font-semibold',
                            isApps
                              ? 'bg-[color-mix(in_srgb,var(--ozer-info)_12%,transparent)] text-[var(--ozer-info)]'
                              : 'bg-[var(--ozer-accent-subtle)] text-[var(--ozer-coral-600)]',
                          )}
                        >
                          {option.priceLabel}
                        </span>
                        {option.recommended ? (
                          <span className="rounded-full bg-[var(--ozer-accent)] px-2 py-0.5 text-[11px] font-semibold text-[var(--ozer-plum-950)]">
                            Popular
                          </span>
                        ) : null}
                        {isApps ? (
                          <span className="rounded-full border border-[var(--ozer-info)]/30 px-2 py-0.5 text-[11px] font-semibold text-[var(--ozer-info)]">
                            Apps only
                          </span>
                        ) : null}
                      </span>
                      <span
                        className={cn('mt-1 block text-sm', marketingMutedText)}
                      >
                        {option.description}
                      </span>
                    </span>
                    <span
                      className={cn(
                        'mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[10px] font-bold',
                        selected && !isApps
                          ? 'border-[var(--ozer-accent)] bg-[var(--ozer-accent)] text-[var(--ozer-plum-950)]'
                          : selected && isApps
                            ? 'border-[var(--ozer-info)] bg-[var(--ozer-info)] text-[var(--ozer-cream-50)]'
                            : 'border-[color:var(--workspace-shell-border)] text-transparent',
                      )}
                      aria-hidden
                    >
                      ✓
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <Button
              type="button"
              variant="ghost"
              className="text-[var(--workspace-shell-text-muted)]"
              onClick={() => setStep('workspace')}
            >
              <ArrowLeft className="mr-1.5 h-4 w-4" />
              Back
            </Button>
            <Button asChild size="lg" className={marketingBtnGradient}>
              <Link href={signupHref}>
                Create free account
                <ArrowRight className="ml-1.5 h-4 w-4" />
              </Link>
            </Button>
          </div>
          <p className={cn('text-center text-sm', marketingMutedText)}>
            Next: create your personal account, then we&apos;ll set up the
            workspace.
          </p>
        </section>
      ) : null}
    </div>
  );
}
