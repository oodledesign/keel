'use client';

/**
 * Pricing map notes (from apps/web/config/billing.config.ts):
 * - Personal & Family has no paid product — always free.
 * - Business maps to Business Solo (£29/mo, £290/yr). billing.config.ts also defines
 *   Business Lite (£0), Team (£79/£790), and Scale (£149/£1490).
 * - Property maps to Property Starter (£19/mo, £190/yr). Portfolio tier is £29/£290.
 * - Community is £12/mo, £120/yr.
 * - Trial length: 14 days (billing.config.ts TRIAL_DAYS; not defined in app.config.ts).
 * - Currency: GBP (KEEL_BILLING_CURRENCY / STRIPE_BILLING_CURRENCY).
 *
 * framer-motion added to apps/web for this component.
 */

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';

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
  Users,
  type LucideIcon,
} from 'lucide-react';

import { Button } from '@kit/ui/button';
import { cn } from '@kit/ui/utils';

import pathsConfig from '~/config/paths.config';
import {
  KEEL_BILLING_CURRENCY,
  KEEL_STRIPE_PRICES,
} from '~/lib/billing/stripe-price-ids';

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
      planId: '',
      variantIds: { monthly: '', annual: '' },
    },
    {
      id: 'business',
      label: 'Business',
      description: 'Clients, projects, invoicing, and pipeline',
      icon: 'Briefcase' as const,
      monthlyPrice: 29,
      annualPrice: 290 / 12,
      alwaysIncluded: false,
      planId: 'keel-business-solo',
      variantIds: {
        monthly: KEEL_STRIPE_PRICES.business_solo_monthly,
        annual: KEEL_STRIPE_PRICES.business_solo_yearly,
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
      planId: 'keel-property-starter',
      variantIds: {
        monthly: KEEL_STRIPE_PRICES.property_starter_monthly,
        annual: KEEL_STRIPE_PRICES.property_starter_yearly,
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
      planId: 'keel-community',
      variantIds: {
        monthly: KEEL_STRIPE_PRICES.community_monthly,
        annual: KEEL_STRIPE_PRICES.community_yearly,
      },
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
type BillingInterval = 'monthly' | 'annual';

const WORKSPACE_ICONS: Record<WorkspaceConfig['icon'], LucideIcon> = {
  Home,
  Briefcase,
  Building2,
  Users,
};

function computeAnnualDiscountPercent() {
  const discounts = PRICING_CONFIG.workspaces
    .filter((workspace) => workspace.monthlyPrice > 0)
    .map((workspace) => {
      const monthlyYearTotal = workspace.monthlyPrice * 12;
      const annualYearTotal = workspace.annualPrice * 12;

      return ((monthlyYearTotal - annualYearTotal) / monthlyYearTotal) * 100;
    });

  return Math.round(Math.max(0, ...discounts));
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

function workspaceUnitPrice(workspace: WorkspaceConfig, billing: BillingInterval) {
  return billing === 'annual' ? workspace.annualPrice : workspace.monthlyPrice;
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
  return (
    <div
      role="radiogroup"
      aria-label="Billing interval"
      className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-[#120f24]/80 p-1"
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
              selected ? 'text-white' : 'text-slate-300 hover:text-white',
            )}
          >
            {selected && !reducedMotion ? (
              <motion.span
                layoutId="billing-pill"
                className="absolute inset-0 rounded-full bg-[#7c3aed]/80"
                transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              />
            ) : selected ? (
              <span className="absolute inset-0 rounded-full bg-[#7c3aed]/80" />
            ) : null}
            <span className="relative z-10 flex items-center gap-2">
              {option}
              {option === 'annual' ? (
                <motion.span
                  initial={false}
                  animate={{
                    opacity: selected ? 1 : 0.75,
                  }}
                  className="rounded-full bg-[#2dd4bf]/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#2dd4bf]"
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

function WorkspaceCard({
  workspace,
  billing,
  selected,
  onToggle,
  reducedMotion,
}: {
  workspace: WorkspaceConfig;
  billing: BillingInterval;
  selected: boolean;
  onToggle: () => void;
  reducedMotion: boolean;
}) {
  const Icon = WORKSPACE_ICONS[workspace.icon];
  const price = workspaceUnitPrice(workspace, billing);
  const locked = workspace.alwaysIncluded;

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
        'bg-[#120f24]/60 backdrop-blur-sm',
        selected
          ? 'border-[#2dd4bf]/60 bg-[#2dd4bf]/10 shadow-[0_12px_40px_rgba(45,212,191,0.12)]'
          : 'border-white/10 shadow-none hover:border-white/20 hover:shadow-[0_12px_40px_rgba(0,0,0,0.35)]',
        locked ? 'cursor-default' : 'cursor-pointer',
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div
          className={cn(
            'flex h-11 w-11 items-center justify-center rounded-xl',
            selected ? 'bg-[#2dd4bf]/15 text-[#2dd4bf]' : 'bg-[#7c3aed]/15 text-violet-300',
          )}
        >
          <Icon className="h-5 w-5" aria-hidden />
        </div>

        <div
          className={cn(
            'flex h-6 w-6 items-center justify-center rounded-md border',
            selected
              ? 'border-[#2dd4bf]/50 bg-[#2dd4bf]/20 text-[#2dd4bf]'
              : 'border-white/15 bg-white/5 text-transparent',
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

      <h3 className="mt-4 font-heading text-lg font-semibold text-white">{workspace.label}</h3>
      <p className="mt-1 text-sm leading-relaxed text-slate-300">{workspace.description}</p>

      <div className="mt-auto pt-5">
        <p className="font-heading text-2xl font-semibold text-white">
          {formatWorkspacePrice(price)}
          {price > 0 ? (
            <span className="text-sm font-normal text-slate-400">/mo</span>
          ) : null}
        </p>
        {billing === 'annual' && price > 0 ? (
          <p className="mt-1 text-xs text-slate-400">Billed annually</p>
        ) : null}
      </div>
    </motion.button>
  );
}

function ComparisonTable({ reducedMotion }: { reducedMotion: boolean }) {
  const [expanded, setExpanded] = useState(false);

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
    <div className="overflow-x-auto rounded-2xl border border-white/10">
      <table className="w-full min-w-[520px] text-left text-sm">
        <thead>
          <tr className="border-b border-white/10 bg-white/[0.03]">
            <th className="px-4 py-3 font-medium text-slate-300">Feature</th>
            <th className="px-4 py-3 font-medium text-slate-300">Typical tools</th>
            <th className="px-4 py-3 font-medium text-[#2dd4bf]">Ozer</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.feature} className="border-b border-white/5 last:border-0">
              <td className="px-4 py-3 text-white">{row.feature}</td>
              <td className="px-4 py-3 text-slate-400">
                {typeof row.typical === 'boolean' ? (
                  row.typical ? (
                    <Check className="h-4 w-4 text-[#2dd4bf]" aria-label="Yes" />
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
                    <Check className="h-4 w-4 text-[#2dd4bf]" aria-label="Yes" />
                  ) : (
                    <span aria-label="No">✗</span>
                  )
                ) : (
                  <span className="font-medium text-white">{row.ozer}</span>
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
        <h3 className="font-heading text-xl font-semibold text-white">Compare the stack</h3>
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          className="text-sm text-[#2dd4bf] underline-offset-4 hover:underline"
        >
          {expanded ? 'Hide comparison' : 'Show comparison'}
        </button>
      </div>

      <h3 className="hidden font-heading text-xl font-semibold text-white lg:block">
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

function PricingFaq({ reducedMotion }: { reducedMotion: boolean }) {
  const items = [
    {
      id: 'add-later',
      question: 'Can I add workspaces later?',
      answer:
        "Yes — add or remove any workspace from your account settings at any time. You're only charged for what you have active.",
    },
    {
      id: 'trial',
      question: 'Is there a free trial?',
      answer: `Yes — paid workspaces include a ${PRICING_CONFIG.trialDays}-day trial on your first subscription.`,
    },
    {
      id: 'multi-business',
      question: 'What if I need more than one business?',
      answer:
        'Each business gets its own workspace. Contact us for multi-business pricing.',
    },
    {
      id: 'cancel',
      question: 'Can I cancel anytime?',
      answer: 'Yes. No lock-in, no cancellation fees.',
    },
    {
      id: 'security',
      question: 'Is my data secure?',
      answer:
        'Ozer is hosted on Supabase/AWS in the EU, with encrypted storage and strict access controls.',
    },
  ] as const;

  const [openId, setOpenId] = useState<string | null>(items[0]?.id ?? null);

  return (
    <div className="space-y-3">
      <h3 className="font-heading text-xl font-semibold text-white">Pricing FAQ</h3>
      {items.map((item) => {
        const open = openId === item.id;

        return (
          <div key={item.id} className="rounded-2xl border border-white/10 bg-[#120f24]/50">
            <button
              type="button"
              aria-expanded={open}
              aria-controls={`faq-${item.id}`}
              onClick={() => setOpenId(open ? null : item.id)}
              className="flex w-full items-center justify-between gap-4 px-4 py-4 text-left"
            >
              <span className="font-medium text-white">{item.question}</span>
              <motion.span
                animate={{ rotate: open ? 180 : 0 }}
                transition={{ duration: reducedMotion ? 0 : 0.2 }}
              >
                <ChevronDown className="h-4 w-4 text-slate-400" aria-hidden />
              </motion.span>
            </button>
            <AnimatePresence initial={false}>
              {open ? (
                <motion.div
                  id={`faq-${item.id}`}
                  role="region"
                  initial={reducedMotion ? false : { height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={reducedMotion ? undefined : { height: 0, opacity: 0 }}
                  transition={{ duration: 0.2, ease: 'easeOut' }}
                  className="overflow-hidden"
                >
                  <p className="px-4 pb-4 text-sm leading-relaxed text-slate-300">
                    {item.answer}
                  </p>
                </motion.div>
              ) : null}
            </AnimatePresence>
          </div>
        );
      })}
    </div>
  );
}

export default function PricingSection() {
  const reducedMotion = useReducedMotion() ?? false;
  const [billing, setBilling] = useState<BillingInterval>('monthly');
  const [selected, setSelected] = useState<Set<string>>(new Set(['personal']));
  const [alwaysIncludedOpen, setAlwaysIncludedOpen] = useState(false);
  const [ctaGlow, setCtaGlow] = useState(false);

  const selectedWorkspaces = useMemo(
    () =>
      PRICING_CONFIG.workspaces.filter((workspace) => selected.has(workspace.id)),
    [selected],
  );

  const total = useMemo(
    () =>
      [...selected]
        .map((id) => {
          const workspace = PRICING_CONFIG.workspaces.find((item) => item.id === id);

          return billing === 'annual'
            ? (workspace?.annualPrice ?? 0)
            : (workspace?.monthlyPrice ?? 0);
        })
        .reduce((sum, price) => sum + price, 0),
    [billing, selected],
  );

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

  return (
    <section className="relative overflow-hidden bg-[radial-gradient(circle_at_15%_0%,rgba(124,58,237,0.25),transparent_42%),linear-gradient(180deg,#0d0b1e_0%,#080711_100%)] py-20 text-white">
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_bottom,rgba(255,255,255,0.03),transparent_22%)]" />

      <div className="relative mx-auto w-full max-w-7xl px-6">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-violet-300/80">
            Simple pricing
          </p>
          <h2 className="mt-3 font-heading text-3xl font-semibold tracking-tight text-white md:text-5xl">
            Build your Ozer
          </h2>
          <p className="mt-4 text-base leading-relaxed text-slate-300 md:text-lg">
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
          <div className="grid gap-4 sm:grid-cols-2">
            {PRICING_CONFIG.workspaces.map((workspace) => (
              <WorkspaceCard
                key={workspace.id}
                workspace={workspace}
                billing={billing}
                selected={selected.has(workspace.id)}
                onToggle={() => toggleWorkspace(workspace.id)}
                reducedMotion={reducedMotion}
              />
            ))}
          </div>

          <aside className="rounded-3xl border border-white/10 bg-[#120f24]/70 p-6 backdrop-blur-sm lg:sticky lg:top-24">
            <h3 className="font-heading text-xl font-semibold text-white">Your plan</h3>

            <ul className="mt-5 space-y-3">
              <AnimatePresence initial={false}>
                {selectedWorkspaces.map((workspace, index) => {
                  const price = workspaceUnitPrice(workspace, billing);

                  return (
                    <motion.li
                      key={workspace.id}
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
                      <span className="text-slate-200">{workspace.label}</span>
                      <span className="font-medium text-white">
                        {formatWorkspacePrice(price)}
                        {price > 0 ? '/mo' : ''}
                      </span>
                    </motion.li>
                  );
                })}
              </AnimatePresence>
            </ul>

            <div className="my-5 border-t border-white/10" />

            <div className="flex items-end justify-between gap-3">
              <span className="text-sm text-slate-400">Total</span>
              <div className="text-right">
                <p className="font-heading text-3xl font-semibold text-white">
                  <AnimatedTotal value={total} reducedMotion={reducedMotion} />
                  {total > 0 ? (
                    <span className="text-base font-normal text-slate-400">/mo</span>
                  ) : null}
                </p>
                <p className="mt-1 text-xs text-slate-400">
                  {billing === 'annual' ? 'Billed annually' : 'Billed monthly'}
                </p>
              </div>
            </div>

            <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.03]">
              <button
                type="button"
                aria-expanded={alwaysIncludedOpen}
                onClick={() => setAlwaysIncludedOpen((value) => !value)}
                className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-sm font-medium text-white"
              >
                Always included
                <motion.span
                  animate={{ rotate: alwaysIncludedOpen ? 180 : 0 }}
                  transition={{ duration: reducedMotion ? 0 : 0.2 }}
                >
                  <ChevronDown className="h-4 w-4 text-slate-400" aria-hidden />
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
                      <li key={feature} className="flex items-start gap-2 text-sm text-slate-300">
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#2dd4bf]" aria-hidden />
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
                'mt-6 h-11 w-full rounded-full bg-gradient-to-r from-[#2dd4bf] to-[#2563EB] text-white hover:opacity-95',
                ctaGlow && !reducedMotion && 'animate-[ozer-cta-glow_1.2s_ease-out_1]',
              )}
            >
              <Link href={pathsConfig.auth.signUp}>Start free →</Link>
            </Button>
            <p className="mt-3 text-center text-xs text-slate-400">
              No credit card required. Cancel anytime.
            </p>
          </aside>
        </div>

        <div className="mt-16 space-y-16">
          <ComparisonTable reducedMotion={reducedMotion} />
          <PricingFaq reducedMotion={reducedMotion} />
        </div>
      </div>

      <style jsx global>{`
        @keyframes ozer-cta-glow {
          0% {
            box-shadow: 0 0 0 0 rgba(45, 212, 191, 0.55);
          }
          100% {
            box-shadow: 0 0 0 18px rgba(45, 212, 191, 0);
          }
        }
      `}</style>
    </section>
  );
}
