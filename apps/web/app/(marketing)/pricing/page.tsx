import Link from 'next/link';

import type { LucideIcon } from 'lucide-react';
import { Activity, LayoutDashboard, ListTodo, Mail, Mic } from 'lucide-react';

import { cn } from '@kit/ui/utils';

import { PricingConversion } from '~/(marketing)/pricing/_components/pricing-conversion';
import {
  formatGbp,
  listBusinessWorkspacePrices,
} from '~/lib/billing/billing-config-prices';
import { MARKETING_FREE_TIER } from '~/lib/billing/pricing-marketing';
import { withI18n } from '~/lib/i18n/with-i18n';
import {
  marketingFeatureCard,
  marketingShellClass,
} from '~/lib/marketing/marketing-ui';
import {
  pricingFaqs,
  replacedStackMonthlyTotal,
} from '~/lib/marketing/pricing-content';
import { JsonLd } from '~/lib/seo/json-ld';
import { buildMarketingMetadata } from '~/lib/seo/marketing-metadata';
import {
  absoluteUrl,
  breadcrumbJsonLd,
  faqPageJsonLd,
  schemaGraph,
  softwareApplicationJsonLd,
} from '~/lib/seo/schema';

const STACK_EXTRAS: Array<{
  label: string;
  href: string;
  icon: LucideIcon;
}> = [
  { label: 'Email Assistant', href: '/features/email-assistant', icon: Mail },
  {
    label: 'Meeting Assistant',
    href: '/features/desktop-assistant',
    icon: Mic,
  },
  { label: 'Activity tracking', href: '/features/activity', icon: Activity },
  { label: 'AI Planner', href: '/features/planner', icon: LayoutDashboard },
  { label: 'Tasks & pipeline', href: '/features/pipeline', icon: ListTodo },
];

function stackSavingPercent(
  stackYear: number,
  ozerYear: number,
): number | null {
  if (stackYear <= 0 || ozerYear >= stackYear) return null;
  return Math.floor(((stackYear - ozerYear) / stackYear) * 100);
}

export const metadata = buildMarketingMetadata({
  title: 'Pricing — flat team price — Ozer',
  description:
    'Ozer pricing: personal and family free; business from £0–£149 per month. Flat price for the whole team — no per-seat maths, no subscription transaction fees.',
  path: '/pricing',
  ogType: 'pricing',
  keywords: [
    'Ozer pricing',
    'freelance software pricing UK',
    'agency CRM cost',
    'flat team pricing',
  ],
});

async function PricingPage() {
  const business = listBusinessWorkspacePrices();
  const offers = [
    {
      name: MARKETING_FREE_TIER.name,
      price: 0,
      description: MARKETING_FREE_TIER.description,
      url: absoluteUrl('/pricing'),
    },
    ...business.map((plan) => ({
      name: plan.productName,
      price: plan.monthlyPriceGbp,
      description: plan.description,
      url: absoluteUrl('/pricing'),
    })),
  ];

  const schema = schemaGraph([
    softwareApplicationJsonLd({
      name: 'Ozer',
      description:
        'Workspace OS pricing in GBP — flat price for the whole team per workspace.',
      url: absoluteUrl('/pricing'),
      offers,
    }),
    breadcrumbJsonLd([
      { name: 'Home', path: '/' },
      { name: 'Pricing', path: '/pricing' },
    ]),
    faqPageJsonLd(pricingFaqs()),
  ]);

  const stackYear = replacedStackMonthlyTotal() * 12;
  const team = business.find((p) => p.productId === 'ozer-business-team');
  const teamYear = team?.yearlyPriceGbp ?? 790;
  const savingPct = stackSavingPercent(stackYear, teamYear);

  return (
    <div className={cn('relative overflow-hidden', marketingShellClass)}>
      <JsonLd data={schema} />
      <div className="relative flex flex-col">
        <div className="container mx-auto px-4 pt-8 pb-8 xl:pb-16">
          <PricingConversion />

          {/* Stage 4 — calculator bridge (full tool on its own route) */}
          <section
            className={cn(
              'mt-16 rounded-2xl border border-[color:var(--workspace-shell-border)] p-6 md:p-8',
              marketingFeatureCard,
            )}
            aria-labelledby="calculator-heading"
          >
            <h2
              id="calculator-heading"
              className="font-heading text-2xl font-semibold text-[var(--workspace-shell-text)]"
            >
              What does this mean for your studio?
            </h2>
            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-[var(--workspace-shell-text-muted)]">
              A typical UK tool stack in our strip totals about{' '}
              {formatGbp(stackYear)} per year. Ozer Business Team is{' '}
              {formatGbp(teamYear)} per year — flat price for the whole team
              {savingPct != null ? (
                <>
                  {' '}
                  (
                  <span className="font-semibold text-[var(--ozer-coral-600)]">
                    about {savingPct}% less
                  </span>
                  )
                </>
              ) : null}
              . And that is not just the apps in the strip — you also get
              personal assistants and tracking that usually sit in separate
              tools.
            </p>

            <ul className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              {STACK_EXTRAS.map(({ label, href, icon: Icon }) => (
                <li key={label}>
                  <Link
                    href={href}
                    className="flex items-center gap-2.5 rounded-xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-canvas)]/60 px-3 py-2.5 text-sm font-medium text-[var(--workspace-shell-text)] transition-colors hover:border-[var(--ozer-accent)]/40 hover:bg-[var(--ozer-accent-subtle)]"
                  >
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--ozer-accent-subtle)] text-[var(--ozer-coral-600)]">
                      <Icon className="h-4 w-4" aria-hidden />
                    </span>
                    {label}
                  </Link>
                </li>
              ))}
            </ul>

            <Link
              href="/tools/stack-cost-calculator"
              className="mt-5 inline-flex text-sm font-medium text-[var(--ozer-coral-600)] underline underline-offset-2"
            >
              Open the stack cost calculator
            </Link>
          </section>
        </div>
      </div>
    </div>
  );
}

export default withI18n(PricingPage);
