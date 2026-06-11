import Link from 'next/link';

import { ArrowRight, Calendar, CheckCircle2, CreditCard, LayoutDashboard, MessagesSquare, Users } from 'lucide-react';

import { Button } from '@kit/ui/button';

import pathsConfig from '~/config/paths.config';
import { withI18n } from '~/lib/i18n/with-i18n';

export const metadata = {
  title: 'Keel - The Life CRM',
  description:
    'Keel is the Life CRM for real life. One calm command center for work, family, community, and relationships.',
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

const stats = [
  { label: 'Less weekly coordination stress', value: '9 hrs/wk' },
  { label: 'Better follow-through across commitments', value: '2.6x' },
  { label: 'Confidence nothing important is missed', value: '94%' },
];

function Home() {
  return (
    <main className="relative overflow-hidden bg-[radial-gradient(circle_at_15%_10%,rgba(168,85,247,0.35),transparent_45%),radial-gradient(circle_at_85%_0%,rgba(124,58,237,0.4),transparent_42%),linear-gradient(180deg,#05050b_0%,#080711_45%,#070612_100%)] text-white">
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_bottom,rgba(255,255,255,0.03),transparent_22%)]" />

      <section className="relative mx-auto flex w-full max-w-7xl flex-col gap-14 px-6 pb-20 pt-24 md:pt-28">
        <div className="grid items-center gap-12 lg:grid-cols-[1.05fr,0.95fr]">
          <div className="space-y-8">
            <span className="inline-flex items-center rounded-full border border-violet-300/20 bg-violet-500/10 px-4 py-1.5 text-xs font-medium uppercase tracking-[0.14em] text-violet-200">
              Keel: The Life CRM
            </span>

            <div className="space-y-5">
              <h1 className="font-heading text-4xl font-bold leading-tight text-white md:text-6xl">
                Organize your life and work
                <span className="bg-gradient-to-r from-violet-300 via-purple-200 to-fuchsia-300 bg-clip-text text-transparent">
                  {' '}
                  from one calm system
                </span>
                .
              </h1>
              <p className="max-w-xl text-base leading-relaxed text-violet-100/85 md:text-lg">
                Keel is the Life CRM for solopreneurs, families, parents, community leaders, and anyone who wants better follow-through with less mental load.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Button asChild size="lg" className="h-11 rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-500 px-6 text-white hover:from-violet-400 hover:to-fuchsia-400">
                <Link href={pathsConfig.auth.signUp}>
                  Start free
                  <ArrowRight className="ml-1.5 h-4 w-4" />
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg" className="h-11 rounded-full border-violet-300/25 bg-[#100d1f]/70 px-6 text-violet-100 hover:bg-[#17122e]">
                <Link href="/pricing">View pricing</Link>
              </Button>
            </div>
          </div>

          <div className="relative rounded-3xl border border-violet-300/15 bg-[#0f0d1e]/85 p-5 shadow-[0_30px_100px_rgba(23,8,50,0.55)] backdrop-blur">
            <div className="absolute -inset-px rounded-3xl bg-[linear-gradient(135deg,rgba(167,139,250,0.35),rgba(236,72,153,0.18),transparent_58%)] opacity-70" />
            <div className="relative rounded-2xl border border-white/10 bg-[#120f24] p-5">
              <div className="mb-4 flex items-center justify-between">
                <p className="text-xs uppercase tracking-[0.12em] text-violet-200/80">Today in Keel</p>
                <LayoutDashboard className="h-4 w-4 text-violet-200/80" />
              </div>
              <div className="space-y-3">
                {['09:00 Parent-teacher check-in prep', '11:30 Follow up on proposal + community event notes', '15:00 Review monthly bills and send 2 reminders'].map((item) => (
                  <div key={item} className="flex items-start gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-3">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-violet-300" />
                    <p className="text-sm text-violet-50/90">{item}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          {stats.map((s) => (
            <div key={s.label} className="rounded-2xl border border-violet-200/10 bg-white/[0.03] px-5 py-4 backdrop-blur">
              <p className="text-2xl font-semibold text-violet-100">{s.value}</p>
              <p className="mt-1 text-xs uppercase tracking-[0.1em] text-violet-200/70">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="relative mx-auto w-full max-w-7xl px-6 pb-24">
        <div className="mb-8">
          <h2 className="font-heading text-3xl font-semibold text-white md:text-4xl">
            Designed to remove cognitive load.
          </h2>
          <p className="mt-3 max-w-2xl text-violet-100/80">
            Keel keeps your priorities visible: what needs action now, what can wait, and what is drifting.
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {features.map((feature) => (
            <article key={feature.title} className="rounded-2xl border border-violet-300/10 bg-[linear-gradient(145deg,rgba(23,18,44,0.95),rgba(13,10,24,0.95))] p-6">
              <feature.icon className="h-5 w-5 text-violet-300" />
              <h3 className="mt-4 font-heading text-xl font-semibold text-white">{feature.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-violet-100/80">{feature.description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="border-t border-violet-200/10 bg-[#070610]/80 py-20">
        <div className="mx-auto flex w-full max-w-7xl flex-col items-center gap-4 px-6 text-center">
          <h2 className="font-heading text-3xl font-semibold text-white md:text-4xl">
            Build a calmer, more intentional life with Keel.
          </h2>
          <p className="max-w-2xl text-violet-100/80">
            If your current setup feels fragmented, Keel gives you one source of truth for projects, people, plans, and priorities.
          </p>
          <Button asChild size="lg" className="mt-2 rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-500 px-7 text-white hover:from-violet-400 hover:to-fuchsia-400">
            <Link href={pathsConfig.auth.signUp}>Create your workspace</Link>
          </Button>
        </div>
      </section>
    </main>
  );
}

export default withI18n(Home);
