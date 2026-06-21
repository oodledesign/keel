import Link from 'next/link';

import { Calendar, CreditCard, MessagesSquare, Users } from 'lucide-react';

import { Button } from '@kit/ui/button';

import pathsConfig from '~/config/paths.config';
import { withI18n } from '~/lib/i18n/with-i18n';

import { MarketingHomeHero } from './_components/marketing-home-hero';
import { InterconnectedWorkspacesSection } from './_components/interconnected-workspaces-section';
import PricingSection from './_components/pricing-section';

// Edited: apps/web/app/(marketing)/page.tsx — hero section (via MarketingHomeHero client child).
// Stats: removed inline stats grid from this file (was 9 hrs/wk, 2.6x, 94% cards).

export const metadata = {
  title: 'Ozer - The Life CRM',
  description:
    'Ozer is the Life CRM that connects personal life, business, family, and community in one account — not another siloed CRM. One home for tasks, planner, and every workspace.',
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
    <main className="relative overflow-hidden bg-[radial-gradient(circle_at_15%_10%,rgba(168,85,247,0.35),transparent_45%),radial-gradient(circle_at_85%_0%,rgba(124,58,237,0.4),transparent_42%),linear-gradient(180deg,#05050b_0%,#080711_45%,#070612_100%)] text-white">
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_bottom,rgba(255,255,255,0.03),transparent_22%)]" />

      <section className="relative mx-auto flex w-full max-w-7xl flex-col px-6 pb-12 pt-24 md:pb-16 md:pt-28">
        <MarketingHomeHero />
      </section>

      <InterconnectedWorkspacesSection />

      <div id="pricing">
        <PricingSection />
      </div>

      <section className="relative mx-auto w-full max-w-7xl px-6 pb-24">
        <div className="mb-8">
          <h2 className="font-heading text-3xl font-semibold text-white md:text-4xl">
            Everything connects through your personal home.
          </h2>
          <p className="mt-3 max-w-2xl text-violet-100/80">
            Ozer keeps priorities visible across workspaces — what needs action now, what can wait, and what is drifting — without switching apps or losing context.
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {features.map((feature) => (
            <article
              key={feature.title}
              className="rounded-2xl border border-violet-300/10 bg-[linear-gradient(145deg,rgba(23,18,44,0.95),rgba(13,10,24,0.95))] p-6"
            >
              <feature.icon className="h-5 w-5 text-violet-300" />
              <h3 className="mt-4 font-heading text-xl font-semibold text-white">
                {feature.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-violet-100/80">
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
              copy: 'CRM inside your Life CRM — not a separate silo.',
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
              className="rounded-2xl border border-violet-300/10 bg-white/[0.03] p-5 transition hover:border-violet-300/25 hover:bg-white/[0.05]"
            >
              <h3 className="font-heading text-lg font-semibold text-white">{item.title}</h3>
              <p className="mt-2 text-sm text-violet-100/75">{item.copy}</p>
            </Link>
          ))}
        </div>
      </section>

      <section className="border-t border-violet-200/10 bg-[#070610]/80 py-20">
        <div className="mx-auto flex w-full max-w-7xl flex-col items-center gap-4 px-6 text-center">
          <h2 className="font-heading text-3xl font-semibold text-white md:text-4xl">
            Build a calmer, more intentional life with Ozer.
          </h2>
          <p className="max-w-2xl text-violet-100/80">
            If your current setup feels fragmented, Ozer gives you one source of truth
            for projects, people, plans, and priorities.
          </p>
          <Button
            asChild
            size="lg"
            className="mt-2 rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-500 px-7 text-white hover:from-violet-400 hover:to-fuchsia-400"
          >
            <Link href={pathsConfig.auth.signUp}>Create your workspace</Link>
          </Button>
        </div>
      </section>
    </main>
  );
}

export default withI18n(Home);
