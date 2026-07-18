import Link from 'next/link';

import {
  Activity,
  Calendar,
  CreditCard,
  MessagesSquare,
  Users,
} from 'lucide-react';

import { Button } from '@kit/ui/button';
import { cn } from '@kit/ui/utils';

import {
  formatGbp,
  getBillingProductPrice,
} from '~/lib/billing/billing-config-prices';
import {
  MARKETING_FREE_SIGNUP_URL,
  MARKETING_FREE_TIER,
  MARKETING_WORKSPACE_PLANS,
} from '~/lib/billing/pricing-marketing';
import { withI18n } from '~/lib/i18n/with-i18n';
import {
  marketingBtnGradient,
  marketingBtnOutline,
  marketingFeatureCard,
  marketingShellClass,
} from '~/lib/marketing/marketing-ui';
import { JsonLd } from '~/lib/seo/json-ld';
import { buildMarketingMetadata } from '~/lib/seo/marketing-metadata';
import {
  absoluteUrl,
  schemaGraph,
  softwareApplicationJsonLd,
} from '~/lib/seo/schema';

import { ComingSoon } from './_components/coming-soon';
import { InterconnectedWorkspacesSection } from './_components/interconnected-workspaces-section';
import {
  MarketingBentoGrid,
  MarketingBentoTile,
} from './_components/marketing-bento';
import { MarketingFinalCta } from './_components/marketing-final-cta';
import { MarketingHomeHero } from './_components/marketing-home-hero';

export const metadata = buildMarketingMetadata({
  title: 'Workspace OS for studios — Ozer',
  description:
    'Ozer is the Workspace OS for freelancers and small studios. Clients, projects, invoices, pipeline, activity tracking, and your plan for the day in one place from £29 per month.',
  path: '/',
  ogType: 'default',
  keywords: [
    'workspace OS',
    'freelance CRM UK',
    'agency software',
    'small business workspace',
  ],
});

const lifeFeatures = [
  {
    icon: Users,
    title: 'People on the record',
    description:
      'Clients, collaborators, and family contacts — context stays with the relationship.',
    span: 'sm' as const,
  },
  {
    icon: Calendar,
    title: 'One plan for the day',
    description:
      'Work priorities and personal plans on one timeline, not three calendars.',
    span: 'tall' as const,
  },
  {
    icon: CreditCard,
    title: 'Money next to the work',
    description:
      'Invoices and outstanding amounts sit on the job — Ozer surfaces what to chase.',
    span: 'sm' as const,
  },
  {
    icon: MessagesSquare,
    title: 'Chat on the project',
    description:
      'Updates and next steps live on the job record, not in personal WhatsApp.',
    span: 'sm' as const,
  },
  {
    icon: Activity,
    title: 'Activity on your Mac',
    description:
      'Ozer Assistant captures app and website sessions — assign time to clients and projects from one view.',
    href: '/features/activity',
    span: 'wide' as const,
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
        'Workspace OS for freelancers and small studios — clients, projects, invoices, pipeline, activity tracking, and your plan for the day in one place.',
      url: absoluteUrl('/'),
      offers,
    }),
  ]);

  return (
    <main className={cn('relative overflow-hidden', marketingShellClass)}>
      <JsonLd data={schema} />

      {/* Tighter top padding so the connection map peeks above the fold */}
      <section className="relative mx-auto flex w-full max-w-7xl flex-col overflow-hidden px-6 pt-14 pb-14 md:pt-20 md:pb-20">
        {/* Soft coral orbs behind the hero */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-0 overflow-hidden"
        >
          <div className="absolute top-[-12%] left-[8%] h-[28rem] w-[28rem] rounded-full bg-[radial-gradient(circle,color-mix(in_srgb,var(--ozer-coral-400)_55%,transparent)_0%,transparent_68%)] blur-2xl md:h-[34rem] md:w-[34rem]" />
          <div className="absolute top-[18%] right-[-8%] h-[22rem] w-[22rem] rounded-full bg-[radial-gradient(circle,color-mix(in_srgb,var(--ozer-coral-500)_40%,transparent)_0%,transparent_70%)] blur-3xl md:h-[28rem] md:w-[28rem]" />
          <div className="absolute bottom-[-10%] left-[35%] h-[18rem] w-[18rem] rounded-full bg-[radial-gradient(circle,color-mix(in_srgb,#ffb48c_50%,transparent)_0%,transparent_72%)] blur-3xl" />
        </div>
        <div className="relative z-10">
          <MarketingHomeHero />
        </div>
      </section>

      <InterconnectedWorkspacesSection tone="light" />

      <section className="relative mx-auto w-full max-w-7xl px-6 pt-16 pb-24 md:pt-24">
        <div className="mb-8 max-w-2xl">
          <h2 className="font-heading text-3xl font-semibold text-[var(--workspace-shell-text)] md:text-4xl">
            Your life connects too — free forever
          </h2>
          <p className="mt-3 text-[var(--workspace-shell-text-muted)]">
            Every other tool stops at the office door. Ozer&apos;s personal and
            family workspaces are free forever, and they share one planner and
            one today view with your studio — school runs and client calls on
            the same timeline.
          </p>
        </div>

        <MarketingBentoGrid>
          {lifeFeatures.map((feature) => {
            const Icon = feature.icon;
            return (
              <MarketingBentoTile
                key={feature.title}
                span={feature.span}
                variant={feature.span === 'wide' ? 'cream' : 'muted'}
                href={'href' in feature ? feature.href : undefined}
                visual={
                  <div className="flex w-full justify-start">
                    <span className="inline-flex size-11 items-center justify-center rounded-2xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] text-[var(--ozer-accent)]">
                      <Icon className="size-5" aria-hidden />
                    </span>
                  </div>
                }
              >
                <h3 className="font-heading text-xl font-semibold text-[var(--workspace-shell-text)]">
                  {feature.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-[var(--workspace-shell-text-muted)]">
                  {feature.description}
                </p>
              </MarketingBentoTile>
            );
          })}

          <MarketingBentoTile span="sm" variant="cream" href="/personal">
            <h3 className="font-heading text-lg font-semibold text-[var(--workspace-shell-text)]">
              Personal &amp; family
            </h3>
            <p className="mt-2 text-sm text-[var(--workspace-shell-text-muted)]">
              Free hub — tasks and planner across every workspace.
            </p>
          </MarketingBentoTile>

          <MarketingBentoTile span="sm" variant="cream" href="/work">
            <h3 className="font-heading text-lg font-semibold text-[var(--workspace-shell-text)]">
              Business
            </h3>
            <p className="mt-2 text-sm text-[var(--workspace-shell-text-muted)]">
              Clients, jobs, and invoices inside the Workspace OS.
            </p>
          </MarketingBentoTile>
        </MarketingBentoGrid>
      </section>

      <section
        id="pricing"
        className="mx-auto w-full max-w-7xl px-6 py-16"
        aria-labelledby="home-pricing-heading"
      >
        <div
          className={cn(
            'rounded-[1.75rem] border border-[color:var(--workspace-shell-border)] p-8 text-center md:p-10',
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
            From{' '}
            {formatGbp(
              getBillingProductPrice('ozer-business-solo')?.monthlyPriceGbp ??
                29,
            )}
            /month for solo freelancers.{' '}
            {formatGbp(
              getBillingProductPrice('ozer-business-team')?.monthlyPriceGbp ??
                79,
            )}
            /month flat for a team of five — no per-seat maths, no transaction
            fees on your subscription.
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

      <MarketingFinalCta
        heading="Run the studio from one home"
        subheading="If your stack is fragmented, Ozer brings projects, people, plans, and priorities into one calm workspace."
        cta={{ label: 'Start free', href: MARKETING_FREE_SIGNUP_URL }}
      />
    </main>
  );
}

export default withI18n(Home);
