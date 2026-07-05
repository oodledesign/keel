import Link from 'next/link';

import { Calendar, Check, CreditCard, MessagesSquare, Users, X } from 'lucide-react';

import { Button } from '@kit/ui/button';

import pathsConfig from '~/config/paths.config';
import { withI18n } from '~/lib/i18n/with-i18n';
import {
  MARKETING_FREE_TIER,
  MARKETING_WORKSPACE_PLANS,
} from '~/lib/billing/pricing-marketing';
import {
  marketingBtnGradient,
  marketingBtnOutline,
  marketingFeatureCard,
  marketingSectionMuted,
  marketingShellClass,
} from '~/lib/marketing/marketing-ui';
import { cn } from '@kit/ui/utils';
import { buildMarketingMetadata } from '~/lib/seo/marketing-metadata';
import { JsonLd } from '~/lib/seo/json-ld';
import {
  absoluteUrl,
  schemaGraph,
  softwareApplicationJsonLd,
} from '~/lib/seo/schema';
import {
  formatGbp,
  getBillingProductPrice,
} from '~/lib/billing/billing-config-prices';

import { MarketingHomeHero } from './_components/marketing-home-hero';
import { ComingSoon } from './_components/coming-soon';
import { INTERCONNECTED_WORKSPACES_MARKETING } from '~/lib/marketing/interconnected-workspaces';

export const metadata = buildMarketingMetadata({
  title: 'Workspace OS for studios — Ozer',
  description:
    'Ozer is the Workspace OS for freelancers and small studios. Clients, projects, invoices, pipeline, and your plan for the day in one place from £29 per month.',
  path: '/',
  ogType: 'default',
  keywords: [
    'workspace OS',
    'freelance CRM UK',
    'agency software',
    'small business workspace',
  ],
});

const features = [
  {
    icon: Users,
    title: 'People on the record',
    description:
      'Clients, collaborators, and family contacts — context stays with the relationship.',
  },
  {
    icon: Calendar,
    title: 'One plan for the day',
    description:
      'Work priorities and personal plans on one timeline, not three calendars.',
  },
  {
    icon: CreditCard,
    title: 'Money next to the work',
    description:
      'Invoices and outstanding amounts sit on the job — Ozer surfaces what to chase.',
  },
  {
    icon: MessagesSquare,
    title: 'Chat on the project',
    description:
      'Updates and next steps live on the job record, not in personal WhatsApp.',
  },
];

function Home() {
  const offers = [
    {
      name: MARKETING_FREE_TIER.name,
      price: 0,
      description: MARKETING_FREE_TIER.description,
      url: absoluteUrl('/pricing'),
    },
    ...MARKETING_WORKSPACE_PLANS.map((plan) => ({
      name: plan.name,
      price: plan.monthlyPriceGbp,
      description: plan.description,
      url: absoluteUrl('/pricing'),
    })),
  ];

  const schema = schemaGraph([
    softwareApplicationJsonLd({
      name: 'Ozer',
      description:
        'Workspace OS for freelancers and small studios — clients, projects, invoices, pipeline, and your plan for the day in one place.',
      url: absoluteUrl('/'),
      offers,
    }),
  ]);

  return (
    <main className={cn('relative overflow-hidden', marketingShellClass)}>
      <JsonLd data={schema} />

      {/* Tighter top padding so the connection map peeks above the fold */}
      <section className="relative mx-auto flex w-full max-w-7xl flex-col px-6 pb-14 pt-14 md:pb-20 md:pt-20">
        <MarketingHomeHero />
      </section>

      <section
        className="relative mx-auto w-full max-w-7xl px-6 py-16"
        aria-labelledby="comparison-heading"
      >
        <div className={cn(marketingFeatureCard, 'rounded-3xl p-6 md:p-10')}>
          <h2
            id="comparison-heading"
            className="text-center font-heading text-3xl font-semibold text-[var(--workspace-shell-text)]"
          >
            {INTERCONNECTED_WORKSPACES_MARKETING.comparison.heading}
          </h2>
          <div className="mt-8 grid gap-6 md:grid-cols-2">
            <ComparisonColumn
              label={INTERCONNECTED_WORKSPACES_MARKETING.comparison.traditionalLabel}
              items={INTERCONNECTED_WORKSPACES_MARKETING.comparison.traditional}
              tone="muted"
            />
            <ComparisonColumn
              label={INTERCONNECTED_WORKSPACES_MARKETING.comparison.ozerLabel}
              items={INTERCONNECTED_WORKSPACES_MARKETING.comparison.ozer}
              tone="ozer"
            />
          </div>
          <p className="mt-8 text-center text-sm font-medium text-[var(--workspace-shell-text-muted)] md:text-base">
            Studio work, family, and personal life — one account.
          </p>
        </div>
      </section>

      <section className="relative mx-auto w-full max-w-7xl px-6 pb-24 pt-16 md:pt-24">
        <div className="mb-8">
          <h2 className="font-heading text-3xl font-semibold text-[var(--workspace-shell-text)] md:text-4xl">
            Your life connects too — free forever
          </h2>
          <p className="mt-3 max-w-2xl text-[var(--workspace-shell-text-muted)]">
            Every other tool stops at the office door. Ozer&apos;s personal and family
            workspaces are free forever, and they share one planner and one today
            view with your studio — school runs and client calls on the same timeline.
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {features.map((feature) => (
            <article
              key={feature.title}
              className={cn(marketingFeatureCard, 'p-6')}
            >
              <feature.icon className="h-5 w-5 text-[var(--ozer-accent)]" aria-hidden />
              <h3 className="mt-4 font-heading text-xl font-semibold text-[var(--workspace-shell-text)]">
                {feature.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-[var(--workspace-shell-text-muted)]">
                {feature.description}
              </p>
            </article>
          ))}
        </div>

        <div className="mt-12 grid gap-4 md:grid-cols-2">
          {[
            {
              href: '/personal',
              title: 'Personal & family',
              copy: 'Free hub — tasks and planner across every workspace.',
            },
            {
              href: '/work',
              title: 'Business',
              copy: 'Clients, jobs, and invoices inside the Workspace OS.',
            },
          ].map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-2xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] p-5 transition-[border-color,background-color] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] hover:border-[var(--ozer-accent)]/25 hover:bg-[var(--workspace-shell-sidebar-accent)]"
            >
              <h3 className="font-heading text-lg font-semibold text-[var(--workspace-shell-text)]">{item.title}</h3>
              <p className="mt-2 text-sm text-[var(--workspace-shell-text-muted)]">{item.copy}</p>
            </Link>
          ))}
        </div>
      </section>

      <section
        id="pricing"
        className="mx-auto w-full max-w-7xl px-6 py-16"
        aria-labelledby="home-pricing-heading"
      >
        <div
          className={cn(
            'rounded-2xl border border-[color:var(--workspace-shell-border)] p-8 text-center',
            marketingFeatureCard,
          )}
        >
          <h2
            id="home-pricing-heading"
            className="font-heading text-3xl font-semibold text-[var(--workspace-shell-text)]"
          >
            Flat price for the whole team
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-[var(--workspace-shell-text-muted)]">
            From {formatGbp(getBillingProductPrice('keel-business-solo')?.monthlyPriceGbp ?? 29)}
            /month for solo freelancers. {formatGbp(
              getBillingProductPrice('keel-business-team')?.monthlyPriceGbp ?? 79,
            )}
            /month flat for a team of five — no per-seat maths, no transaction fees
            on your subscription.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Button asChild className={marketingBtnGradient}>
              <Link href="/pricing">See pricing</Link>
            </Button>
            <Button asChild variant="outline" className={marketingBtnOutline}>
              <Link href="/pricing/explained">Ozer pricing, explained</Link>
            </Button>
          </div>
        </div>
      </section>

      <ComingSoon />

      <section className={cn('py-20', marketingSectionMuted)}>
        <div className="mx-auto flex w-full max-w-7xl flex-col items-center gap-4 px-6 text-center">
          <h2 className="font-heading text-3xl font-semibold text-[var(--workspace-shell-text)] md:text-4xl">
            Run the studio from one home
          </h2>
          <p className="max-w-2xl text-[var(--workspace-shell-text-muted)]">
            If your stack is fragmented, Ozer brings projects, people, plans, and
            priorities into one calm workspace.
          </p>
          <Button
            asChild
            size="lg"
            className={cn('mt-2', marketingBtnGradient)}
          >
            <Link href={pathsConfig.auth.signUp}>Start free</Link>
          </Button>
        </div>
      </section>
    </main>
  );
}

function ComparisonColumn({
  label,
  items,
  tone,
}: {
  label: string;
  items: readonly string[];
  tone: 'muted' | 'ozer';
}) {
  const isOzer = tone === 'ozer';

  return (
    <div
      className={cn(
        'rounded-2xl border p-5 md:p-6',
        isOzer
          ? 'border-[var(--ozer-accent)]/35 bg-[var(--ozer-accent-subtle)]'
          : 'border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)]',
      )}
    >
      <p
        className={cn(
          'text-sm font-semibold uppercase tracking-wide',
          isOzer ? 'text-[var(--ozer-coral-600)]' : 'text-[var(--ozer-plum-700)]',
        )}
      >
        {label}
      </p>
      <ul className="mt-4 space-y-3">
        {items.map((item) => (
          <li key={item} className="flex gap-2.5 text-sm leading-relaxed">
            {isOzer ? (
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-[var(--ozer-accent)]" aria-hidden />
            ) : (
              <X className="mt-0.5 h-4 w-4 shrink-0 text-[var(--workspace-shell-text-muted)]" aria-hidden />
            )}
            <span className={isOzer ? 'text-[var(--ozer-text-on-light)]' : 'text-[var(--ozer-text-on-light-muted)]'}>
              {item}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default withI18n(Home);
