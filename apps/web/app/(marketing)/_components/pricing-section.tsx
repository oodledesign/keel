'use client';

/**
 * Pricing map notes (from apps/web/config/billing.config.ts):
 * - Personal & Family has no paid product — always free.
 * - Business tiers: Lite (£0), Solo (£29/£290), Team (£79/£790), Scale (£149/£1490).
 * - Property tiers: Starter (£19/£190), Portfolio (£29/£290).
 * - Community is £12/mo, £120/yr.
 * - Personal add-ons: Email Assistant (£9/mo); Meeting Assistant (at launch, Stripe TBD).
 * - Workspace add-ons: Signatures (£9), Rankly (£36), Feedflow (£9), Videos (£5–£47).
 * - Trial length: 14 days (billing.config.ts TRIAL_DAYS).
 * - Currency: GBP (KEEL_BILLING_CURRENCY).
 */

import Link from 'next/link';
import { createContext, useContext, useEffect, useMemo, useState } from 'react';

import {
  AnimatePresence,
  motion,
  useMotionValueEvent,
  useReducedMotion,
  useSpring,
  useTransform,
} from 'framer-motion';
import {
  Briefcase,
  Building2,
  Check,
  ChevronDown,
  Home,
  Lock,
  Mail,
  Mic,
  Puzzle,
  Sparkles,
  Users,
  type LucideIcon,
} from 'lucide-react';

import { Button } from '@kit/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@kit/ui/tooltip';
import { cn } from '@kit/ui/utils';

import pathsConfig from '~/config/paths.config';
import {
  getPricingTheme,
  type PricingTheme,
  type PricingTone,
} from '~/lib/marketing/pricing-theme';
import {
  KEEL_BILLING_CURRENCY,
  KEEL_STRIPE_PRICES,
} from '~/lib/billing/stripe-price-ids';

import {
  MarketingFaqsSection,
  type MarketingFaqItem,
} from './marketing-faqs';

const PricingThemeContext = createContext<PricingTheme>(getPricingTheme('dark'));

function usePricingTheme() {
  return useContext(PricingThemeContext);
}

const PRICING_CONFIG = {
  currency: KEEL_BILLING_CURRENCY,
  trialDays: 14,
  workspaces: [
    {
      id: 'personal',
      label: 'Personal & Family',
      description: 'Tasks, planner, and shortcuts across all workspaces',
      icon: 'Home' as const,
      monthlyPrice: 0,
      annualPrice: 0,
      alwaysIncluded: true,
      hasTiers: false,
      planId: '',
      variantIds: { monthly: '', annual: '' },
      highlights: [
        'Today view & unified task list',
        'AI planner & custom shortcuts',
        'Hub connecting every workspace',
      ],
      assistants: {
        email: { tooltip: 'Email assistant — £9/mo add-on', state: 'addon' as const },
        meeting: { tooltip: 'Meeting Assistant — personal add-on, available at launch', state: 'addon' as const },
        planner: { tooltip: 'AI planner included', state: 'included' as const },
      },
    },
    {
      id: 'business',
      label: 'Business',
      description: 'Clients, projects, invoicing, and pipeline',
      icon: 'Briefcase' as const,
      monthlyPrice: 29,
      annualPrice: 290 / 12,
      alwaysIncluded: false,
      hasTiers: true,
      planId: 'keel-business-solo',
      variantIds: {
        monthly: KEEL_STRIPE_PRICES.business_solo_monthly,
        annual: KEEL_STRIPE_PRICES.business_solo_yearly,
      },
      highlights: [
        'Clients, projects & pipeline',
        'Invoicing, proposals & quotes',
        'CRM tiers from Lite to Scale',
      ],
      assistants: {
        email: { tooltip: 'Email assistant on your personal account', state: 'addon' as const },
        meeting: { tooltip: 'Meeting Assistant — personal add-on, available at launch', state: 'addon' as const },
        planner: { tooltip: 'AI planner via your personal home', state: 'included' as const },
      },
    },
    {
      id: 'property',
      label: 'Property',
      description: 'Tenants, maintenance, and portfolio finances',
      icon: 'Building2' as const,
      monthlyPrice: 19,
      annualPrice: 190 / 12,
      alwaysIncluded: false,
      hasTiers: true,
      planId: 'keel-property-starter',
      variantIds: {
        monthly: KEEL_STRIPE_PRICES.property_starter_monthly,
        annual: KEEL_STRIPE_PRICES.property_starter_yearly,
      },
      highlights: [
        'Tenants & maintenance tracking',
        'Portfolio finances & documents',
        'Starter or Portfolio tiers',
      ],
      assistants: {
        email: { tooltip: 'Email assistant on your personal account', state: 'addon' as const },
        meeting: { tooltip: 'Meeting Assistant — personal add-on, available at launch', state: 'addon' as const },
        planner: { tooltip: 'AI planner via your personal home', state: 'included' as const },
      },
    },
    {
      id: 'community',
      label: 'Community',
      description: 'Events, volunteers, and group schedules',
      icon: 'Users' as const,
      monthlyPrice: 12,
      annualPrice: 120 / 12,
      alwaysIncluded: false,
      hasTiers: false,
      planId: 'keel-community',
      variantIds: {
        monthly: KEEL_STRIPE_PRICES.community_monthly,
        annual: KEEL_STRIPE_PRICES.community_yearly,
      },
      highlights: [
        'Events & volunteer coordination',
        'Shared group schedules',
        'Community task boards',
      ],
      assistants: {
        email: { tooltip: 'Email assistant on your personal account', state: 'addon' as const },
        meeting: { tooltip: 'Meeting Assistant — personal add-on, available at launch', state: 'addon' as const },
        planner: { tooltip: 'AI planner via your personal home', state: 'included' as const },
      },
    },
  ],
  businessTiers: [
    {
      id: 'business-lite',
      label: 'Lite',
      description: 'Free apps workspace — add Signatures, Rankly, and more à la carte',
      monthlyPrice: 0,
      annualPrice: 0,
      badge: 'Apps only',
      planId: 'business-lite-free',
      productId: 'keel-business-lite',
      variantIds: {
        monthly: KEEL_STRIPE_PRICES.business_lite_monthly,
        annual: KEEL_STRIPE_PRICES.business_lite_monthly,
      },
    },
    {
      id: 'business-solo',
      label: 'Solo',
      description: 'Full CRM for one person',
      monthlyPrice: 29,
      annualPrice: 290 / 12,
      planId: 'business-solo-monthly',
      productId: 'keel-business-solo',
      variantIds: {
        monthly: KEEL_STRIPE_PRICES.business_solo_monthly,
        annual: KEEL_STRIPE_PRICES.business_solo_yearly,
      },
    },
    {
      id: 'business-team',
      label: 'Team',
      description: 'Up to 5 team members',
      monthlyPrice: 79,
      annualPrice: 790 / 12,
      badge: 'Popular',
      planId: 'business-team-monthly',
      productId: 'keel-business-team',
      variantIds: {
        monthly: KEEL_STRIPE_PRICES.business_team_monthly,
        annual: KEEL_STRIPE_PRICES.business_team_yearly,
      },
    },
    {
      id: 'business-scale',
      label: 'Scale',
      description: 'Up to 15 team members',
      monthlyPrice: 149,
      annualPrice: 1490 / 12,
      planId: 'business-scale-monthly',
      productId: 'keel-business-scale',
      variantIds: {
        monthly: KEEL_STRIPE_PRICES.business_scale_monthly,
        annual: KEEL_STRIPE_PRICES.business_scale_yearly,
      },
    },
  ],
  propertyTiers: [
    {
      id: 'property-starter',
      label: 'Starter',
      description: 'Up to 5 properties',
      monthlyPrice: 19,
      annualPrice: 190 / 12,
      planId: 'property-starter-monthly',
      productId: 'keel-property-starter',
      variantIds: {
        monthly: KEEL_STRIPE_PRICES.property_starter_monthly,
        annual: KEEL_STRIPE_PRICES.property_starter_yearly,
      },
    },
    {
      id: 'property-portfolio',
      label: 'Portfolio',
      description: 'Up to 20 properties',
      monthlyPrice: 29,
      annualPrice: 290 / 12,
      planId: 'property-portfolio-monthly',
      productId: 'keel-property-portfolio',
      variantIds: {
        monthly: KEEL_STRIPE_PRICES.property_portfolio_monthly,
        annual: KEEL_STRIPE_PRICES.property_portfolio_yearly,
      },
    },
  ],
  personalAddons: [
    {
      id: 'email-assistant',
      label: 'Email Assistant',
      description: 'Gmail sync, AI action items, and draft replies in your personal home',
      monthlyPrice: 9,
      icon: 'Mail' as const,
      planId: 'email-assistant-monthly',
      productId: 'keel-addon-email-assistant',
      variantId: KEEL_STRIPE_PRICES.addon_email_assistant_monthly,
    },
    {
      id: 'meeting-assistant',
      label: 'Meeting Assistant',
      description:
        'Record, transcribe, and extract tasks from meetings — synced to the right workspace',
      monthlyPrice: 0,
      icon: 'Mic' as const,
      availableAtLaunch: true,
      planId: '',
      productId: '',
      variantId: '',
    },
    {
      id: 'planner',
      label: 'AI Planner',
      description: 'Today view, day planning, and priorities pulled from every workspace',
      monthlyPrice: 0,
      icon: 'Sparkles' as const,
      included: true,
      planId: '',
      productId: '',
      variantId: '',
    },
  ],
  workspaceAddons: [
    {
      id: 'signatures',
      label: 'Signatures',
      description: 'Branded email signatures for Microsoft 365 and Google Workspace',
      monthlyPrice: 9,
      planId: 'signatures-monthly',
      productId: 'keel-addon-signatures',
      variantId: KEEL_STRIPE_PRICES.addon_signatures_monthly,
    },
    {
      id: 'rankly',
      label: 'Rankly',
      description: 'SEO rankings, PageSpeed, and AI insights',
      monthlyPrice: 36,
      planId: 'rankly-monthly',
      productId: 'keel-addon-rankly',
      variantId: KEEL_STRIPE_PRICES.addon_rankly_monthly,
    },
    {
      id: 'feedflow',
      label: 'Feedflow',
      description: 'Reviews and social content for your brand',
      monthlyPrice: 9,
      planId: 'feedflow-monthly',
      productId: 'keel-addon-feedflow',
      variantId: KEEL_STRIPE_PRICES.addon_feedflow_monthly,
    },
  ],
  videoTiers: [
    {
      id: 'videos-starter',
      label: 'Videos Starter',
      description: 'Up to 5 hosted videos',
      monthlyPrice: 5,
      planId: 'videos-starter-monthly',
      productId: 'keel-addon-videos-starter',
      variantId: KEEL_STRIPE_PRICES.addon_videos_starter_monthly,
    },
    {
      id: 'videos-growth',
      label: 'Videos Growth',
      description: 'Up to 20 hosted videos',
      monthlyPrice: 12,
      planId: 'videos-growth-monthly',
      productId: 'keel-addon-videos-growth',
      variantId: KEEL_STRIPE_PRICES.addon_videos_growth_monthly,
    },
    {
      id: 'videos-pro',
      label: 'Videos Pro',
      description: 'Up to 49 hosted videos',
      monthlyPrice: 29,
      planId: 'videos-pro-monthly',
      productId: 'keel-addon-videos-pro',
      variantId: KEEL_STRIPE_PRICES.addon_videos_pro_monthly,
    },
    {
      id: 'videos-studio',
      label: 'Videos Studio',
      description: 'Up to 100 hosted videos',
      monthlyPrice: 47,
      planId: 'videos-studio-monthly',
      productId: 'keel-addon-videos-studio',
      variantId: KEEL_STRIPE_PRICES.addon_videos_studio_monthly,
    },
  ],
  alwaysIncludedFeatures: [
    'Personal home dashboard',
    'Today view & AI planner',
    'Unified task list',
    'Mobile app',
    'Shared calendar context',
  ],
} as const;

type WorkspaceConfig = (typeof PRICING_CONFIG.workspaces)[number];
type TierConfig =
  | (typeof PRICING_CONFIG.businessTiers)[number]
  | (typeof PRICING_CONFIG.propertyTiers)[number];
type BillingInterval = 'monthly' | 'annual';

type SummaryLineItem = {
  id: string;
  label: string;
  price: number;
};

const WORKSPACE_ICONS: Record<WorkspaceConfig['icon'], LucideIcon> = {
  Home,
  Briefcase,
  Building2,
  Users,
};

const ADDON_ICONS: Record<'Mail' | 'Mic' | 'Sparkles', LucideIcon> = {
  Mail,
  Mic,
  Sparkles,
};

const ASSISTANT_BADGE_ICONS = {
  email: Mail,
  meeting: Mic,
  planner: Sparkles,
} as const;

function computeAnnualDiscountPercent() {
  const tierPrices = [
    ...PRICING_CONFIG.businessTiers,
    ...PRICING_CONFIG.propertyTiers,
    ...PRICING_CONFIG.workspaces.filter((workspace) => !workspace.hasTiers),
  ];

  const discounts = tierPrices
    .filter((item) => item.monthlyPrice > 0)
    .map((item) => {
      const monthlyYearTotal = item.monthlyPrice * 12;
      const annualYearTotal = item.annualPrice * 12;

      return ((monthlyYearTotal - annualYearTotal) / monthlyYearTotal) * 100;
    });

  // Truth-check: one decimal place — never round 16.7% up to 17%.
  const max = Math.max(0, ...discounts);
  return Math.round(max * 10) / 10;
}

const ANNUAL_DISCOUNT_PERCENT = computeAnnualDiscountPercent();

function formatWorkspacePrice(amount: number) {
  if (amount === 0) return 'Free';

  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: PRICING_CONFIG.currency,
    maximumFractionDigits: amount % 1 === 0 ? 0 : 2,
  }).format(amount);
}

function formatTotalPrice(amount: number) {
  if (amount === 0) return 'Free';

  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: PRICING_CONFIG.currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

function tierUnitPrice(tier: TierConfig, billing: BillingInterval) {
  return billing === 'annual' ? tier.annualPrice : tier.monthlyPrice;
}

function workspaceUnitPrice(
  workspace: WorkspaceConfig,
  billing: BillingInterval,
  businessTierId: string,
  propertyTierId: string,
) {
  if (workspace.id === 'business') {
    const tier = PRICING_CONFIG.businessTiers.find((item) => item.id === businessTierId);

    return tier ? tierUnitPrice(tier, billing) : 0;
  }

  if (workspace.id === 'property') {
    const tier = PRICING_CONFIG.propertyTiers.find((item) => item.id === propertyTierId);

    return tier ? tierUnitPrice(tier, billing) : 0;
  }

  return billing === 'annual' ? workspace.annualPrice : workspace.monthlyPrice;
}

function workspaceCardPriceLabel(workspace: WorkspaceConfig) {
  if (workspace.id === 'business') {
    return `From ${formatWorkspacePrice(29)}/mo`;
  }

  if (workspace.id === 'property') {
    return `From ${formatWorkspacePrice(19)}/mo`;
  }

  const price = workspace.monthlyPrice;

  return price === 0
    ? 'Free'
    : `${formatWorkspacePrice(price)}/mo`;
}

function buildSummaryLineItems(params: {
  selected: Set<string>;
  billing: BillingInterval;
  businessTierId: string;
  propertyTierId: string;
  selectedAddons: Set<string>;
  videoTierId: string;
}): SummaryLineItem[] {
  const items: SummaryLineItem[] = [];
  const paidWorkspaceCount = [...params.selected].filter((id) => id !== 'personal').length;

  for (const workspace of PRICING_CONFIG.workspaces) {
    if (!params.selected.has(workspace.id)) continue;

    if (workspace.id === 'business') {
      const tier = PRICING_CONFIG.businessTiers.find(
        (item) => item.id === params.businessTierId,
      );

      items.push({
        id: 'business',
        label: `Business ${tier?.label ?? 'Solo'}`,
        price: tier ? tierUnitPrice(tier, params.billing) : 0,
      });
      continue;
    }

    if (workspace.id === 'property') {
      const tier = PRICING_CONFIG.propertyTiers.find(
        (item) => item.id === params.propertyTierId,
      );

      items.push({
        id: 'property',
        label: `Property ${tier?.label ?? 'Starter'}`,
        price: tier ? tierUnitPrice(tier, params.billing) : 0,
      });
      continue;
    }

    items.push({
      id: workspace.id,
      label: workspace.label,
      price: workspaceUnitPrice(
        workspace,
        params.billing,
        params.businessTierId,
        params.propertyTierId,
      ),
    });
  }

  for (const addon of PRICING_CONFIG.personalAddons) {
    if (!params.selectedAddons.has(addon.id)) continue;
    if ('comingSoon' in addon && addon.comingSoon) continue;
    if ('included' in addon && addon.included) continue;

    items.push({
      id: addon.id,
      label: addon.label,
      price: addon.monthlyPrice,
    });
  }

  for (const addon of PRICING_CONFIG.workspaceAddons) {
    if (!params.selectedAddons.has(addon.id) || paidWorkspaceCount === 0) continue;

    items.push({
      id: addon.id,
      label:
        paidWorkspaceCount > 1
          ? `${addon.label} × ${paidWorkspaceCount} workspaces`
          : addon.label,
      price: addon.monthlyPrice * paidWorkspaceCount,
    });
  }

  if (params.selectedAddons.has('videos') && paidWorkspaceCount > 0) {
    const tier = PRICING_CONFIG.videoTiers.find((item) => item.id === params.videoTierId);

    if (tier) {
      items.push({
        id: 'videos',
        label:
          paidWorkspaceCount > 1
            ? `${tier.label} × ${paidWorkspaceCount} workspaces`
            : tier.label,
        price: tier.monthlyPrice * paidWorkspaceCount,
      });
    }
  }

  return items;
}

function summaryTotal(items: SummaryLineItem[]) {
  return items.reduce((sum, item) => sum + item.price, 0);
}

function AnimatedTotal({ value, reducedMotion }: { value: number; reducedMotion: boolean }) {
  const spring = useSpring(reducedMotion ? value : 0, {
    stiffness: 100,
    damping: 20,
  });

  useEffect(() => {
    spring.set(value);
  }, [spring, value]);

  const display = useTransform(spring, (current) => formatTotalPrice(current));
  const [label, setLabel] = useState(formatTotalPrice(reducedMotion ? value : 0));

  useMotionValueEvent(display, 'change', setLabel);

  return <span>{label}</span>;
}

function BillingToggle({
  billing,
  onChange,
  reducedMotion,
}: {
  billing: BillingInterval;
  onChange: (value: BillingInterval) => void;
  reducedMotion: boolean;
}) {
  const t = usePricingTheme();

  return (
    <div
      role="radiogroup"
      aria-label="Billing interval"
      className={t.toggleTrack}
    >
      {(['monthly', 'annual'] as const).map((option) => {
        const selected = billing === option;

        return (
          <button
            key={option}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(option)}
            className={cn(
              'relative rounded-full px-4 py-2 text-sm font-medium capitalize transition-colors',
              selected ? t.toggleText : t.toggleTextInactive,
            )}
          >
            {selected && !reducedMotion ? (
              <motion.span
                layoutId="billing-pill"
                className={cn('absolute inset-0 rounded-full', t.togglePill)}
                transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              />
            ) : selected ? (
              <span className={cn('absolute inset-0 rounded-full', t.togglePill)} />
            ) : null}
            <span className="relative z-10 flex items-center gap-2">
              {option}
              {option === 'annual' ? (
                <motion.span
                  initial={false}
                  animate={{
                    opacity: selected ? 1 : 0.75,
                  }}
                  className="rounded-full bg-[var(--ozer-accent-subtle)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--ozer-accent)]"
                >
                  Save {ANNUAL_DISCOUNT_PERCENT}%
                </motion.span>
              ) : null}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function WorkspaceAssistantBadges({
  assistants,
}: {
  assistants: WorkspaceConfig['assistants'];
}) {
  const t = usePricingTheme();

  return (
    <div className="mt-3 flex flex-wrap gap-1.5">
      {(Object.keys(ASSISTANT_BADGE_ICONS) as Array<keyof typeof ASSISTANT_BADGE_ICONS>).map(
        (key) => {
          const Icon = ASSISTANT_BADGE_ICONS[key];
          const badge = assistants[key];
          const isIncluded = badge.state === 'included';
          const isComingSoon = badge.state === 'coming-soon';

          return (
            <Tooltip key={key}>
              <TooltipTrigger asChild>
                <span
                  className={cn(
                    'inline-flex h-7 w-7 items-center justify-center rounded-md border',
                    isIncluded
                      ? 'border-[var(--ozer-accent)]/40 bg-[var(--ozer-accent-subtle)] text-[var(--ozer-accent)]'
                      : isComingSoon
                        ? cn('border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)]', t.muted)
                        : 'border-[var(--ozer-lime-400)]/30 bg-[var(--ozer-lime-400)]/10 text-[var(--ozer-lime-400)]',
                  )}
                >
                  <Icon className="h-3.5 w-3.5" aria-hidden />
                </span>
              </TooltipTrigger>
              <TooltipContent
                side="top"
                className={t.tooltip}
              >
                {badge.tooltip}
              </TooltipContent>
            </Tooltip>
          );
        },
      )}
    </div>
  );
}

function WorkspaceCard({
  workspace,
  billing,
  selected,
  onToggle,
  reducedMotion,
  priceLabel,
}: {
  workspace: WorkspaceConfig;
  billing: BillingInterval;
  selected: boolean;
  onToggle: () => void;
  reducedMotion: boolean;
  priceLabel: string;
}) {
  const Icon = WORKSPACE_ICONS[workspace.icon];
  const locked = workspace.alwaysIncluded;
  const t = usePricingTheme();

  return (
    <motion.button
      type="button"
      role="checkbox"
      aria-checked={selected}
      aria-disabled={locked}
      disabled={locked}
      onClick={locked ? undefined : onToggle}
      whileHover={
        locked || reducedMotion
          ? undefined
          : { y: -2, transition: { duration: 0.15, ease: 'easeOut' } }
      }
      animate={
        selected
          ? reducedMotion
            ? { scale: 1 }
            : { scale: [1, 1.03, 1] }
          : { scale: 1 }
      }
      transition={
        selected && !reducedMotion
          ? { type: 'spring', stiffness: 400, damping: 20 }
          : { duration: 0.15 }
      }
      className={cn(
        'relative flex h-full flex-col rounded-2xl border p-5 text-left transition-shadow duration-150',
        t.card,
        selected ? t.cardSelected : t.cardUnselected,
        locked ? 'cursor-default' : 'cursor-pointer',
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div
          className={cn(
            'flex h-11 w-11 items-center justify-center rounded-xl',
            selected ? 'bg-[var(--ozer-success-muted)]/15 text-[var(--ozer-success-muted)]' : 'bg-[var(--ozer-info)]/15 text-[var(--ozer-info)]',
          )}
        >
          <Icon className="h-5 w-5" aria-hidden />
        </div>

        <div
          className={cn(
            'flex h-6 w-6 items-center justify-center rounded-md border',
            selected
              ? 'border-[var(--ozer-accent)]/50 bg-[var(--ozer-accent)]/20 text-[var(--ozer-accent)]'
              : 'border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] text-transparent',
          )}
        >
          <AnimatePresence mode="wait">
            {selected ? (
              <motion.span
                key="check"
                initial={reducedMotion ? false : { scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={reducedMotion ? undefined : { scale: 0, opacity: 0 }}
                transition={{ type: 'spring', stiffness: 400, damping: 20 }}
              >
                {locked ? (
                  <Lock className="h-3.5 w-3.5" aria-hidden />
                ) : (
                  <Check className="h-3.5 w-3.5" aria-hidden />
                )}
              </motion.span>
            ) : null}
          </AnimatePresence>
        </div>
      </div>

      <h3 className={cn('mt-4 font-heading text-lg font-semibold', t.text)}>{workspace.label}</h3>
      <p className={cn('mt-1 text-sm leading-relaxed', t.muted)}>{workspace.description}</p>

      <WorkspaceAssistantBadges assistants={workspace.assistants} />

      <ul className="mt-3 space-y-1">
        {workspace.highlights.map((line) => (
          <li key={line} className={cn('flex gap-2 text-xs leading-relaxed', t.muted)}>
            <Check className="mt-0.5 h-3 w-3 shrink-0 text-[var(--ozer-accent)]/70" aria-hidden />
            <span>{line}</span>
          </li>
        ))}
      </ul>

      <div className="mt-auto pt-4">
        <p className={cn('font-heading text-2xl font-semibold', t.text)}>{priceLabel}</p>
        {workspace.hasTiers && selected ? (
          <p className={cn('mt-1 text-xs', t.muted)}>Choose your tier below</p>
        ) : billing === 'annual' && workspace.monthlyPrice > 0 && selected ? (
          <p className={cn('mt-1 text-xs', t.muted)}>Billed annually</p>
        ) : null}
      </div>
    </motion.button>
  );
}

function TierPicker({
  title,
  tiers,
  selectedTierId,
  onSelect,
  billing,
  reducedMotion,
}: {
  title: string;
  tiers: readonly TierConfig[];
  selectedTierId: string;
  onSelect: (tierId: string) => void;
  billing: BillingInterval;
  reducedMotion: boolean;
}) {
  const t = usePricingTheme();

  return (
    <motion.div
      initial={reducedMotion ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={reducedMotion ? undefined : { opacity: 0, y: 8 }}
      className={t.tierPanel}
    >
      <h4 className={cn('font-heading text-sm font-semibold uppercase tracking-wide', t.muted)}>
        {title}
      </h4>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {tiers.map((tier) => {
          const selected = tier.id === selectedTierId;
          const price = tierUnitPrice(tier, billing);

          return (
            <button
              key={tier.id}
              type="button"
              onClick={() => onSelect(tier.id)}
              className={cn(
                'rounded-xl border px-4 py-3 text-left transition-colors',
                selected
                  ? 'border-[var(--ozer-accent)]/60 bg-[var(--ozer-accent-subtle)]'
                  : 'border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] hover:border-[color:var(--workspace-shell-border)]',
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <span className={cn('font-medium', t.text)}>{tier.label}</span>
                {'badge' in tier && tier.badge ? (
                  <span className="rounded-full bg-[var(--ozer-lime-400)]/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--ozer-lime-400)]">
                    {tier.badge}
                  </span>
                ) : null}
              </div>
              <p className={cn('mt-1 text-xs', t.muted)}>{tier.description}</p>
              <p className={cn('mt-2 text-sm font-semibold', t.text)}>
                {formatWorkspacePrice(price)}
                {price > 0 ? '/mo' : ''}
              </p>
            </button>
          );
        })}
      </div>
    </motion.div>
  );
}

function AddonToggle({
  label,
  description,
  priceLabel,
  selected,
  onToggle,
  icon: Icon,
  disabled,
}: {
  label: string;
  description: string;
  priceLabel: string;
  selected: boolean;
  onToggle: () => void;
  icon?: LucideIcon;
  disabled?: boolean;
}) {
  const t = usePricingTheme();

  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={selected}
      aria-disabled={disabled}
      disabled={disabled}
      onClick={disabled ? undefined : onToggle}
      className={cn(
        'rounded-xl border px-4 py-3 text-left transition-colors',
        disabled
          ? 'cursor-default border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] opacity-90'
          : selected
            ? 'border-[var(--ozer-accent)]/60 bg-[var(--ozer-accent-subtle)]'
            : 'border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] hover:border-[color:var(--workspace-shell-border)]',
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex gap-3">
          {Icon ? (
            <span
              className={cn(
                'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg',
                selected && !disabled
                  ? 'bg-[var(--ozer-accent-subtle)] text-[var(--ozer-accent)]'
                  : 'bg-[var(--ozer-lime-400)]/10 text-[var(--ozer-lime-400)]',
              )}
            >
              <Icon className="h-4 w-4" aria-hidden />
            </span>
          ) : null}
          <div>
            <p className={cn('font-medium', t.text)}>{label}</p>
            <p className={cn('mt-1 text-xs leading-relaxed', t.muted)}>{description}</p>
          </div>
        </div>
        <span
          className={cn(
            'shrink-0 text-sm font-semibold',
            disabled ? t.muted : 'text-[var(--ozer-accent)]',
          )}
        >
          {priceLabel}
        </span>
      </div>
    </button>
  );
}

function AddonsPanel({
  selected,
  selectedAddons,
  onToggleAddon,
  videoTierId,
  onVideoTierChange,
  paidWorkspaceCount,
  reducedMotion,
}: {
  selected: Set<string>;
  selectedAddons: Set<string>;
  onToggleAddon: (id: string) => void;
  videoTierId: string;
  onVideoTierChange: (tierId: string) => void;
  paidWorkspaceCount: number;
  reducedMotion: boolean;
}) {
  const t = usePricingTheme();
  const videosSelected = selectedAddons.has('videos');
  const workspaceMultiplier =
    paidWorkspaceCount > 1 ? ` × ${paidWorkspaceCount} workspaces` : '';

  return (
    <div className={t.addonsPanel}>
      <div>
        <h4 className={cn('font-heading text-lg font-semibold', t.text)}>Add-ons</h4>
        <p className={cn('mt-1 text-sm', t.muted)}>
          Optional extras on top of your workspaces. Workspace add-ons are priced per
          workspace.
        </p>
      </div>

      <div className="space-y-3">
        <div className={cn('flex items-center gap-2 text-xs font-semibold uppercase tracking-wide', t.muted)}>
          <span className="inline-flex items-center gap-1">
            <Mail className="h-3.5 w-3.5" aria-hidden />
            <Mic className="h-3.5 w-3.5" aria-hidden />
            <Sparkles className="h-3.5 w-3.5" aria-hidden />
          </span>
          Personal add-ons
        </div>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {PRICING_CONFIG.personalAddons.map((addon) => {
            const Icon = ADDON_ICONS[addon.icon];
            const isComingSoon = 'comingSoon' in addon && addon.comingSoon;
            const isAvailableAtLaunch =
              'availableAtLaunch' in addon && addon.availableAtLaunch;
            const isIncluded = 'included' in addon && addon.included;

            return (
              <AddonToggle
                key={addon.id}
                icon={Icon}
                label={addon.label}
                description={addon.description}
                priceLabel={
                  isIncluded
                    ? 'Included'
                    : isComingSoon
                      ? 'Coming soon'
                      : isAvailableAtLaunch
                        ? 'At launch'
                        : `${formatWorkspacePrice(addon.monthlyPrice)}/mo`
                }
                selected={isIncluded || selectedAddons.has(addon.id)}
                disabled={isComingSoon || isIncluded || isAvailableAtLaunch}
                onToggle={() => onToggleAddon(addon.id)}
              />
            );
          })}
        </div>
      </div>

      <div className="space-y-3">
        <div className={cn('flex items-center gap-2 text-xs font-semibold uppercase tracking-wide', t.muted)}>
          <Puzzle className="h-3.5 w-3.5" aria-hidden />
          Workspace apps
          {paidWorkspaceCount === 0 ? (
            <span className={cn('font-normal normal-case', t.muted)}>
              — select a paid workspace first
            </span>
          ) : null}
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          {PRICING_CONFIG.workspaceAddons.map((addon) => (
            <AddonToggle
              key={addon.id}
              label={addon.label}
              description={addon.description}
              priceLabel={`${formatWorkspacePrice(addon.monthlyPrice)}/mo${workspaceMultiplier}`}
              selected={selectedAddons.has(addon.id)}
              onToggle={() => {
                if (paidWorkspaceCount === 0) return;
                onToggleAddon(addon.id);
              }}
            />
          ))}
          <AddonToggle
            label="Videos hosting"
            description="Hosted video libraries with embeds and sharing"
            priceLabel={`From ${formatWorkspacePrice(5)}/mo${workspaceMultiplier}`}
            selected={videosSelected}
            onToggle={() => {
              if (paidWorkspaceCount === 0) return;
              onToggleAddon('videos');
            }}
          />
        </div>

        <AnimatePresence initial={false}>
          {videosSelected ? (
            <motion.div
              initial={reducedMotion ? false : { height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={reducedMotion ? undefined : { height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <label className={cn('block text-xs font-medium uppercase tracking-wide', t.muted)}>
                Videos tier
                <select
                  value={videoTierId}
                  onChange={(event) => onVideoTierChange(event.target.value)}
                  className={cn(
                    'mt-2 w-full rounded-lg border border-[color:var(--workspace-shell-border)] px-3 py-2 text-sm',
                    t.card,
                    t.text,
                  )}
                >
                  {PRICING_CONFIG.videoTiers.map((tier) => (
                    <option key={tier.id} value={tier.id}>
                      {tier.label} — {formatWorkspacePrice(tier.monthlyPrice)}/mo (
                      {tier.description})
                    </option>
                  ))}
                </select>
              </label>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>

      {selected.has('business') ? (
        <p className={cn('flex items-start gap-2 text-xs', t.muted)}>
          <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--ozer-lime-400)]" aria-hidden />
          Business Lite is free and built for the apps marketplace — pick Lite above if you
          only need Signatures, Rankly, or other add-ons without full CRM features.
        </p>
      ) : null}

      <p className={cn('text-xs', t.muted)}>
        Add-ons are monthly only today. See{' '}
        <Link href="/pricing" className="text-[var(--ozer-accent)] underline-offset-4 hover:underline">
          full pricing
        </Link>{' '}
        for feature lists.
      </p>
    </div>
  );
}

const PRICING_FAQS: MarketingFaqItem[] = [
  {
    question: 'How do add-ons like Email Assistant or Rankly work?',
    answer:
      'Personal add-ons attach to your home account. Workspace apps attach to each business, property, or community workspace you run — so Rankly on two workspaces means two subscriptions.',
  },
  {
    question: 'Can I add workspaces later?',
    answer:
      "Yes — add or remove any workspace from your account settings at any time. You're only charged for what you have active.",
  },
  {
    question: 'Is there a free trial?',
    answer: `Yes — paid workspaces include a ${PRICING_CONFIG.trialDays}-day trial on your first subscription.`,
  },
  {
    question: 'What if I need more than one business?',
    answer: 'Each business gets its own workspace. Contact us for multi-business pricing.',
  },
  {
    question: 'Can I cancel anytime?',
    answer: 'Yes. No lock-in, no cancellation fees.',
  },
  {
    question: 'Is my data secure?',
    answer:
      'Ozer is hosted on Supabase/AWS in the EU, with encrypted storage and strict access controls.',
  },
];

function ComparisonTable({ reducedMotion }: { reducedMotion: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const t = usePricingTheme();

  const rows = [
    {
      feature: 'Apps needed to do the same job',
      typical: '5–8',
      ozer: '1',
    },
    {
      feature: 'Shared today view across work & life',
      typical: false,
      ozer: true,
    },
    {
      feature: 'Tasks unified across workspaces',
      typical: false,
      ozer: true,
    },
    {
      feature: 'One login for everything',
      typical: false,
      ozer: true,
    },
    {
      feature: 'AI day planner',
      typical: false,
      ozer: true,
    },
    {
      feature: 'Flexible workspace add-ons',
      typical: false,
      ozer: true,
    },
  ] as const;

  const table = (
    <div className="overflow-x-auto rounded-2xl border border-[color:var(--workspace-shell-border)]">
      <table className="w-full min-w-[520px] text-left text-sm">
        <thead>
          <tr className="border-b border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)]">
            <th className={cn('px-4 py-3 font-medium', t.muted)}>Feature</th>
            <th className={cn('px-4 py-3 font-medium', t.muted)}>Typical tools</th>
            <th className="px-4 py-3 font-medium text-[var(--ozer-accent)]">Ozer</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.feature} className="border-b border-[color:var(--workspace-shell-border)] last:border-0">
              <td className={cn('px-4 py-3', t.text)}>{row.feature}</td>
              <td className={cn('px-4 py-3', t.muted)}>
                {typeof row.typical === 'boolean' ? (
                  row.typical ? (
                    <Check className="h-4 w-4 text-[var(--ozer-accent)]" aria-label="Yes" />
                  ) : (
                    <span aria-label="No">✗</span>
                  )
                ) : (
                  row.typical
                )}
              </td>
              <td className="px-4 py-3">
                {typeof row.ozer === 'boolean' ? (
                  row.ozer ? (
                    <Check className="h-4 w-4 text-[var(--ozer-accent)]" aria-label="Yes" />
                  ) : (
                    <span aria-label="No">✗</span>
                  )
                ) : (
                  <span className={cn('font-medium', t.text)}>{row.ozer}</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 lg:hidden">
        <h3 className={cn('font-heading text-xl font-semibold', t.text)}>Compare the stack</h3>
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          className="text-sm text-[var(--ozer-accent)] underline-offset-4 hover:underline"
        >
          {expanded ? 'Hide comparison' : 'Show comparison'}
        </button>
      </div>

      <h3 className={cn('hidden font-heading text-xl font-semibold lg:block', t.text)}>
        Compare the stack
      </h3>

      <div className="hidden lg:block">{table}</div>

      <AnimatePresence initial={false}>
        {expanded ? (
          <motion.div
            key="comparison-mobile"
            initial={reducedMotion ? false : { height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={reducedMotion ? undefined : { height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            className="overflow-hidden lg:hidden"
          >
            {table}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

export default function PricingSection({ tone = 'dark' }: { tone?: PricingTone }) {
  const reducedMotion = useReducedMotion() ?? false;
  const theme = useMemo(() => getPricingTheme(tone), [tone]);
  const [billing, setBilling] = useState<BillingInterval>('monthly');
  const [selected, setSelected] = useState<Set<string>>(new Set(['personal']));
  const [businessTierId, setBusinessTierId] = useState('business-solo');
  const [propertyTierId, setPropertyTierId] = useState('property-starter');
  const [selectedAddons, setSelectedAddons] = useState<Set<string>>(new Set());
  const [videoTierId, setVideoTierId] = useState('videos-starter');
  const [alwaysIncludedOpen, setAlwaysIncludedOpen] = useState(false);
  const [ctaGlow, setCtaGlow] = useState(false);

  const paidWorkspaceCount = useMemo(
    () => [...selected].filter((id) => id !== 'personal').length,
    [selected],
  );

  const summaryLineItems = useMemo(
    () =>
      buildSummaryLineItems({
        selected,
        billing,
        businessTierId,
        propertyTierId,
        selectedAddons,
        videoTierId,
      }),
    [selected, billing, businessTierId, propertyTierId, selectedAddons, videoTierId],
  );

  const total = useMemo(() => summaryTotal(summaryLineItems), [summaryLineItems]);

  const toggleWorkspace = (id: string) => {
    if (id === 'personal') return;

    setSelected((current) => {
      const next = new Set(current);

      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
        if (!ctaGlow) setCtaGlow(true);
      }

      return next;
    });
  };

  const toggleAddon = (id: string) => {
    const addon = PRICING_CONFIG.personalAddons.find((item) => item.id === id);

    if (addon && 'comingSoon' in addon && addon.comingSoon) return;
    if (addon && 'included' in addon && addon.included) return;

    setSelectedAddons((current) => {
      const next = new Set(current);

      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
        if (!ctaGlow) setCtaGlow(true);
      }

      return next;
    });
  };

  return (
    <PricingThemeContext.Provider value={theme}>
    <TooltipProvider delayDuration={200}>
    <section className={theme.section}>
      <div className={theme.sectionGlow} />

      <div className="relative mx-auto w-full max-w-7xl px-6">
        <div className="mx-auto max-w-3xl text-center">
          <p className={theme.eyebrow}>
            Simple pricing
          </p>
          <h2 className={theme.title}>
            Build your Ozer
          </h2>
          <p className={theme.subtitle}>
            Start with your personal home free. Add the workspaces you need.
          </p>
          <div className="mt-8 flex justify-center">
            <BillingToggle
              billing={billing}
              onChange={setBilling}
              reducedMotion={reducedMotion}
            />
          </div>
        </div>

        <div className="mt-12 grid gap-8 lg:grid-cols-[1.2fr,0.8fr] lg:items-start">
          <div className="space-y-4">
            <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
              {PRICING_CONFIG.workspaces.map((workspace) => (
                <WorkspaceCard
                  key={workspace.id}
                  workspace={workspace}
                  billing={billing}
                  selected={selected.has(workspace.id)}
                  onToggle={() => toggleWorkspace(workspace.id)}
                  reducedMotion={reducedMotion}
                  priceLabel={
                    workspace.hasTiers && selected.has(workspace.id)
                      ? `${formatWorkspacePrice(
                          workspaceUnitPrice(
                            workspace,
                            billing,
                            businessTierId,
                            propertyTierId,
                          ),
                        )}${workspaceUnitPrice(workspace, billing, businessTierId, propertyTierId) > 0 ? '/mo' : ''}`
                      : workspaceCardPriceLabel(workspace)
                  }
                />
              ))}
            </div>

            <AnimatePresence initial={false}>
              {selected.has('business') ? (
                <TierPicker
                  key="business-tiers"
                  title="Business tier"
                  tiers={PRICING_CONFIG.businessTiers}
                  selectedTierId={businessTierId}
                  onSelect={setBusinessTierId}
                  billing={billing}
                  reducedMotion={reducedMotion}
                />
              ) : null}
              {selected.has('property') ? (
                <TierPicker
                  key="property-tiers"
                  title="Property tier"
                  tiers={PRICING_CONFIG.propertyTiers}
                  selectedTierId={propertyTierId}
                  onSelect={setPropertyTierId}
                  billing={billing}
                  reducedMotion={reducedMotion}
                />
              ) : null}
            </AnimatePresence>

            <AddonsPanel
              selected={selected}
              selectedAddons={selectedAddons}
              onToggleAddon={toggleAddon}
              videoTierId={videoTierId}
              onVideoTierChange={setVideoTierId}
              paidWorkspaceCount={paidWorkspaceCount}
              reducedMotion={reducedMotion}
            />
          </div>

          <aside className={theme.panel}>
            <h3 className={cn('font-heading text-xl font-semibold', theme.text)}>Your plan</h3>

            <ul className="mt-5 space-y-3">
              <AnimatePresence initial={false}>
                {summaryLineItems.map((item, index) => (
                  <motion.li
                    key={item.id}
                    initial={reducedMotion ? false : { opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={reducedMotion ? undefined : { opacity: 0, x: 8 }}
                    transition={{
                      duration: reducedMotion ? 0 : 0.2,
                      delay: reducedMotion ? 0 : index * 0.05,
                      ease: 'easeOut',
                    }}
                    className="flex items-center justify-between gap-3 text-sm"
                  >
                    <span className={cn('font-medium', theme.lineLabel)}>{item.label}</span>
                    <span className={cn('font-medium', theme.text)}>
                      {formatWorkspacePrice(item.price)}
                      {item.price > 0 ? '/mo' : ''}
                    </span>
                  </motion.li>
                ))}
              </AnimatePresence>
            </ul>

            <div className="my-5 border-t border-[color:var(--workspace-shell-border)]" />

            <div className="flex items-end justify-between gap-3">
              <span className={cn('text-sm', theme.muted)}>Total</span>
              <div className="text-right">
                <p className={cn('font-heading text-3xl font-semibold', theme.text)}>
                  <AnimatedTotal value={total} reducedMotion={reducedMotion} />
                  {total > 0 ? (
                    <span className={cn('text-base font-normal', theme.muted)}>/mo</span>
                  ) : null}
                </p>
                <p className={cn('mt-1 text-xs', theme.muted)}>
                  {billing === 'annual' ? 'Billed annually' : 'Billed monthly'}
                </p>
              </div>
            </div>

            <div className={theme.panelInner}>
              <button
                type="button"
                aria-expanded={alwaysIncludedOpen}
                onClick={() => setAlwaysIncludedOpen((value) => !value)}
                className={cn('flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-sm font-medium', theme.text)}
              >
                Always included
                <motion.span
                  animate={{ rotate: alwaysIncludedOpen ? 180 : 0 }}
                  transition={{ duration: reducedMotion ? 0 : 0.2 }}
                >
                  <ChevronDown className={cn('h-4 w-4', theme.muted)} aria-hidden />
                </motion.span>
              </button>
              <AnimatePresence initial={false}>
                {alwaysIncludedOpen ? (
                  <motion.ul
                    initial={reducedMotion ? false : { height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={reducedMotion ? undefined : { height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="space-y-2 overflow-hidden px-4 pb-4"
                  >
                    {PRICING_CONFIG.alwaysIncludedFeatures.map((feature) => (
                      <li key={feature} className={cn('flex items-start gap-2 text-sm', theme.muted)}>
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-[var(--ozer-accent)]" aria-hidden />
                        {feature}
                      </li>
                    ))}
                  </motion.ul>
                ) : null}
              </AnimatePresence>
            </div>

            <Button
              asChild
              size="lg"
              className={cn(
                'mt-6 h-11 w-full rounded-full bg-[var(--ozer-accent)] text-[var(--ozer-plum-950)] hover:bg-[var(--ozer-accent-hover)]',
                ctaGlow && !reducedMotion && 'animate-[ozer-cta-glow_1.2s_ease-out_1]',
              )}
            >
              <Link href={pathsConfig.auth.signUp}>Start free</Link>
            </Button>
            <p className={cn('mt-3 text-center text-xs', theme.muted)}>
              No credit card required. Cancel anytime.
            </p>
          </aside>
        </div>

        <div className="mt-16">
          <ComparisonTable reducedMotion={reducedMotion} />
        </div>

        <MarketingFaqsSection
          faqs={PRICING_FAQS}
          tone={theme.faqTone}
          title="Pricing FAQ"
          headingId="pricing-faq-heading"
          sectionClassName="mt-16 py-0"
          className="px-0"
        />
      </div>

      <style jsx global>{`
        @keyframes ozer-cta-glow {
          0% {
            box-shadow: 0 0 0 0 var(--ozer-coral-alpha-45);
          }
          100% {
            box-shadow: 0 0 0 18px transparent;
          }
        }
      `}</style>
    </section>
    </TooltipProvider>
    </PricingThemeContext.Provider>
  );
}
