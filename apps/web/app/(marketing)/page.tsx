import Link from 'next/link';

import { Calendar, CreditCard, MessagesSquare, Users } from 'lucide-react';

import { Button } from '@kit/ui/button';

import pathsConfig from '~/config/paths.config';
import { withI18n } from '~/lib/i18n/with-i18n';
import {
  marketingBtnGradient,
  marketingFeatureCard,
  marketingSectionMuted,
  marketingShellClass,
} from '~/lib/marketing/marketing-ui';
import { cn } from '@kit/ui/utils';

import { MarketingHomeHero } from './_components/marketing-home-hero';
import { InterconnectedWorkspacesSection } from './_components/interconnected-workspaces-section';
import PricingSection from './_components/pricing-section';

// Edited: apps/web/app/(marketing)/page.tsx — hero section (via MarketingHomeHero client child).
// Stats: removed inline stats grid from this file (was 9 hrs/wk, 2.6x, 94% cards).
// Task A: Life CRM → OS copy (business segment card).

export const metadata = {
  title: 'Ozer — The Workspace OS',
  description:
    'Ozer is the workspace OS for freelancers and small agencies — personal, business, property, and community in one account. One home for tasks, planner, and every workspace.',
};

const features = [
  {
    icon: Users,
    title: 'People and relationships in one place',
    description:
      'Keep context for clients, collaborators, family members, friends, and community contacts.',
  },
  {
    icon: Calendar,
    title: 'Plans and routines that stay in sync',
    description:
      'Coordinate appointments, school events, work priorities, and personal plans from one timeline.',
  },
  {
    icon: CreditCard,
    title: 'Money and admin without the scramble',
    description:
      'Track invoices, bills, subscriptions, and important tasks so life feels more predictable.',
  },
  {
    icon: MessagesSquare,
    title: 'Conversations that never go missing',
    description:
      'Capture key updates, reminders, and next steps so every conversation leads to action.',
  },
];

function Home() {
  return (
    <main className={cn('relative overflow-hidden', marketingShellClass)}>
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_bottom,rgba(255,255,255,0.03),transparent_22%)]" />

      <section className="relative mx-auto flex w-full max-w-7xl flex-col px-6 pb-14 pt-24 md:pb-20 md:pt-32">
        <MarketingHomeHero />
      </section>

      <InterconnectedWorkspacesSection />

      <div id="pricing">
        <PricingSection />
      </div>

      <section className="relative mx-auto w-full max-w-7xl px-6 pb-24 pt-16 md:pt-24">
        <div className="mb-8">
          <h2 className="font-heading text-3xl font-semibold text-[var(--workspace-shell-text)] md:text-4xl">
            Everything connects through your personal home.
          </h2>
          <p className="mt-3 max-w-2xl text-[var(--workspace-shell-text-muted)]">
            Ozer keeps priorities visible across workspaces — what needs action now, what can wait, and what is drifting — without switching apps or losing context.
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {features.map((feature) => (
            <article
              key={feature.title}
              className={cn(marketingFeatureCard, 'p-6')}
            >
              <feature.icon className="h-5 w-5 text-[var(--ozer-accent)]" />
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
              copy: 'Free hub — tasks, planner, and shortcuts across all workspaces.',
            },
            {
              href: '/work',
              title: 'Business',
              copy: 'Client management inside your workspace OS.',
            },
            {
              href: '/property',
              title: 'Property',
              copy: 'Tenants, maintenance, and portfolio finances.',
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
            Build a calmer, more intentional life with Ozer.
          </h2>
          <p className="max-w-2xl text-[var(--workspace-shell-text-muted)]">
            If your current setup feels fragmented, Ozer gives you one source of truth
            for projects, people, plans, and priorities.
          </p>
          <Button
            asChild
            size="lg"
            className={cn('mt-2', marketingBtnGradient)}
          >
            <Link href={pathsConfig.auth.signUp}>Create your workspace</Link>
          </Button>
        </div>
      </section>
    </main>
  );
}

export default withI18n(Home);
