import Link from 'next/link';

import { Calendar, CreditCard, MessagesSquare, Users } from 'lucide-react';

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
import { InterconnectedWorkspacesSection } from './_components/interconnected-workspaces-section';

export const metadata = buildMarketingMetadata({
  title: 'Workspace OS for studios — Ozer',
  description:
    'Ozer is the Workspace OS for freelancers and small agencies. Personal and family stay free; business plans from £0–£29 per month with a flat price for the whole team.',
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
      'Clients, collaborators, family, and community contacts — context stays with the relationship.',
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
        'Workspace OS for freelancers and small agencies — personal, business, property, and community in one account.',
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

      <InterconnectedWorkspacesSection />

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
            Personal and family free. Business Team{' '}
            {formatGbp(
              getBillingProductPrice('keel-business-team')?.monthlyPriceGbp ?? 79,
            )}{' '}
            per month — no per-seat maths, no subscription transaction fees.
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

      <section className="relative mx-auto w-full max-w-7xl px-6 pb-24 pt-16 md:pt-24">
        <div className="mb-8">
          <h2 className="font-heading text-3xl font-semibold text-[var(--workspace-shell-text)] md:text-4xl">
            Everything connects through personal home
          </h2>
          <p className="mt-3 max-w-2xl text-[var(--workspace-shell-text-muted)]">
            See what needs action across workspaces — without switching apps or losing context.
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

        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
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
            {
              href: '/property',
              title: 'Property',
              copy: 'Tenants, maintenance, and portfolio money.',
            },
            {
              href: '/community',
              title: 'Community',
              copy: 'Schedules and tasks for clubs and homegroups.',
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

      <section className={cn('py-20', marketingSectionMuted)}>
        <div className="mx-auto flex w-full max-w-7xl flex-col items-center gap-4 px-6 text-center">
          <h2 className="font-heading text-3xl font-semibold text-[var(--workspace-shell-text)] md:text-4xl">
            Run the studio from one home
          </h2>
          <p className="max-w-2xl text-[var(--workspace-shell-text-muted)]">
            If your stack is fragmented, Ozer is one Workspace OS for projects, people,
            plans, and priorities — without a per-seat tax.
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

export default withI18n(Home);
