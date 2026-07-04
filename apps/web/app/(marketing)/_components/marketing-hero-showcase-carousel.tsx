'use client';

import type { ReactNode } from 'react';
import { useState } from 'react';
import Image from 'next/image';

import { useReducedMotion } from 'framer-motion';
import {
  Brain,
  CalendarDays,
  CheckCircle2,
  CreditCard,
  LayoutDashboard,
  Mic,
  Search,
  Sparkles,
  Users,
} from 'lucide-react';

import { cn } from '@kit/ui/utils';

type ShowcaseCard = {
  id: string;
  width: number;
  featureLabel?: string;
  /** Shown in the bottom-left badge, joined with · (e.g. Meeting Assistant · Dictation). */
  featureTags?: string[];
  render: () => ReactNode;
};

const TODAY_PREVIEW = [
  { time: '09:00', text: 'School run prep', tag: 'Personal', color: 'var(--ozer-sage-500)' },
  { time: '10:30', text: 'Review Acme proposal', tag: 'Business', color: 'var(--ozer-accent)' },
  { time: '15:00', text: 'Community event notes', tag: 'Community', color: 'var(--ozer-sky-100)' },
] as const;

const SHOWCASE_CARDS: ShowcaseCard[] = [
  {
    id: 'today',
    width: 300,
    featureLabel: 'Today view',
    render: () => (
      <div className="flex h-full flex-col rounded-[1.75rem] border border-[color:var(--ozer-border-on-dark)] bg-[var(--ozer-plum-950)] p-4">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--ozer-text-on-dark-muted)]">
            Today in Ozer
          </p>
          <LayoutDashboard className="h-3.5 w-3.5 text-[var(--ozer-text-on-dark-muted)]" />
        </div>
        <div className="space-y-2">
          {TODAY_PREVIEW.map((item) => (
            <div
              key={item.text}
              className="flex items-start gap-2 rounded-xl border border-[color:var(--ozer-border-on-dark)] bg-[var(--ozer-plum-800)]/60 px-2.5 py-2"
            >
              <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--ozer-coral-400)]" />
              <div className="min-w-0">
                <p className="truncate text-xs text-[var(--ozer-text-on-dark)]">
                  <span className="font-mono text-[10px] text-[var(--ozer-text-on-dark-muted)]">
                    {item.time}
                  </span>{' '}
                  {item.text}
                </p>
                <span className="mt-0.5 inline-flex items-center gap-1 rounded-md border border-[color:var(--ozer-border-on-dark)] px-1 py-0.5 text-[9px] text-[var(--ozer-text-on-dark-muted)]">
                  <span
                    className="h-1 w-1 rounded-full"
                    style={{ backgroundColor: item.color }}
                  />
                  {item.tag}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    ),
  },
  {
    id: 'workspaces-stat',
    width: 260,
    featureLabel: 'Workspaces',
    render: () => (
      <div className="flex h-full flex-col justify-between rounded-[1.75rem] bg-[var(--ozer-coral-50)] p-5 text-[var(--ozer-text-on-light)]">
        <div className="flex -space-x-2">
          {['var(--ozer-sage-500)', 'var(--ozer-sky-100)', 'var(--ozer-accent)'].map((color) => (
            <span
              key={color}
              className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-[color:var(--ozer-border-on-light)] text-[10px] font-bold text-[var(--ozer-plum-950)]"
              style={{ backgroundColor: color }}
            >
              K
            </span>
          ))}
        </div>
        <div>
          <p className="font-heading text-3xl font-bold">4</p>
          <p className="text-sm font-medium text-[var(--ozer-text-on-light-muted)]">Workspaces, one home</p>
          <p className="mt-1 text-xs text-[var(--ozer-text-on-light-muted)]">
            Personal, business, property & community
          </p>
        </div>
      </div>
    ),
  },
  {
    id: 'dashboard',
    width: 420,
    featureLabel: 'Home dashboard',
    render: () => (
      <div className="relative h-full overflow-hidden rounded-[1.75rem] border border-[color:var(--workspace-shell-border)] bg-[var(--ozer-plum-950)]">
        <Image
          src="/images/dashboard.webp"
          alt="Ozer dashboard overview"
          fill
          className="object-cover object-top"
          sizes="420px"
        />
        <div className="absolute inset-x-0 bottom-0 bg-[var(--ozer-plum-950)] p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--ozer-text-on-dark-muted)]">
            Your home dashboard
          </p>
        </div>
      </div>
    ),
  },
  {
    id: 'pipeline',
    width: 320,
    featureLabel: 'Pipeline',
    render: () => (
      <div className="flex h-full flex-col rounded-[1.75rem] bg-[var(--ozer-sky-100)] p-4 text-[var(--ozer-text-on-light)]">
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--ozer-slate-blue)]">
          Pipeline
        </p>
        <div className="mt-3 grid flex-1 grid-cols-3 gap-2">
          {[
            { label: 'Lead', count: 4, tone: 'bg-[var(--ozer-white)]' },
            { label: 'Proposal', count: 2, tone: 'bg-[var(--ozer-cream-50)]' },
            { label: 'Won', count: 1, tone: 'bg-[var(--ozer-sage-100)]' },
          ].map((col) => (
            <div key={col.label} className={cn('rounded-xl p-2', col.tone)}>
              <p className="text-[10px] font-semibold text-[var(--ozer-text-on-light-muted)]">{col.label}</p>
              <p className="mt-2 font-heading text-xl font-bold">{col.count}</p>
            </div>
          ))}
        </div>
      </div>
    ),
  },
  {
    id: 'planner',
    width: 280,
    featureLabel: 'Planner',
    render: () => (
      <div className="flex h-full flex-col rounded-[1.75rem] bg-[var(--ozer-lime-100)] p-4 text-[var(--ozer-text-on-light)]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CalendarDays className="h-4 w-4 text-[var(--ozer-plum-900)]" />
            <p className="text-sm font-semibold">This week</p>
          </div>
          <span className="rounded-md bg-[var(--ozer-lime-400)] px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-[var(--ozer-plum-950)]">
            Today
          </span>
        </div>
        <div className="mt-3 grid flex-1 grid-cols-7 gap-1">
          {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((day, index) => (
            <div
              key={`${day}-${index}`}
              className={cn(
                'flex aspect-square items-center justify-center rounded-lg text-[10px] font-medium',
                index === 2
                  ? 'bg-[var(--ozer-accent)] text-[var(--ozer-white)]'
                  : 'bg-[var(--ozer-white)] text-[var(--ozer-text-on-light-muted)]',
              )}
            >
              {day}
            </div>
          ))}
        </div>
        <div className="mt-2 space-y-1">
          <p className="text-xs font-medium text-[var(--ozer-text-on-light)]">Wed — 3 priorities</p>
          <p className="truncate text-[10px] text-[var(--ozer-text-on-light-muted)]">
            Ship proposal · School run · Community AGM prep
          </p>
        </div>
      </div>
    ),
  },
  {
    id: 'meeting-assistant',
    width: 340,
    featureLabel: 'Desktop Assistant',
    render: () => (
      <div className="flex h-full flex-col rounded-[1.75rem] border border-[color:var(--ozer-border-on-dark)] bg-[var(--ozer-plum-950)] p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--ozer-accent-subtle)]">
              <Mic className="h-3.5 w-3.5 text-[var(--ozer-coral-400)]" />
            </span>
            <div>
              <p className="text-xs font-semibold text-[var(--ozer-text-on-dark)]">Client kickoff</p>
              <p className="text-[10px] text-[var(--ozer-text-on-dark-muted)]">Recording · 24:18</p>
            </div>
          </div>
          <span className="rounded-full bg-[var(--ozer-accent)] px-2 py-0.5 text-[9px] font-medium text-[var(--ozer-plum-950)]">
            Live
          </span>
        </div>
        <div className="mt-3 flex-1 space-y-1.5 overflow-hidden">
          {[
            { speaker: 'You', text: 'Let’s align on scope for phase one…' },
            { speaker: 'Client', text: 'We need the proposal by Friday.' },
          ].map((line) => (
            <div
              key={line.speaker}
              className="rounded-lg border border-[color:var(--ozer-border-on-dark)] bg-[var(--ozer-plum-800)] px-2.5 py-1.5"
            >
              <p className="text-[9px] font-semibold uppercase tracking-wide text-[var(--ozer-coral-400)]">
                {line.speaker}
              </p>
              <p className="truncate text-[11px] text-[var(--ozer-text-on-dark)]">{line.text}</p>
            </div>
          ))}
        </div>
        <div className="mt-2 flex flex-wrap gap-1">
          <span className="rounded-md border border-[color:var(--ozer-border-on-dark)] bg-[var(--ozer-plum-800)] px-1.5 py-0.5 text-[9px] text-[var(--ozer-lime-400)]">
            3 tasks extracted
          </span>
          <span className="rounded-md border border-[color:var(--ozer-border-on-dark)] bg-[var(--ozer-plum-800)] px-1.5 py-0.5 text-[9px] text-[var(--ozer-text-on-dark-muted)]">
            Follow-up drafted
          </span>
        </div>
      </div>
    ),
  },
  {
    id: 'dictation',
    width: 300,
    featureLabel: 'Dictation',
    render: () => (
      <div className="flex h-full flex-col rounded-[1.75rem] border border-[color:var(--ozer-border-on-dark)] bg-[var(--ozer-plum-900)] p-4">
        <div className="flex items-center gap-2">
          <span className="rounded-md border border-[color:var(--ozer-border-on-dark)] bg-[var(--ozer-plum-800)] px-1.5 py-0.5 font-mono text-[9px] text-[var(--ozer-text-on-dark-muted)]">
            fn
          </span>
          <p className="text-xs font-semibold text-[var(--ozer-text-on-dark)]">Dictating…</p>
        </div>
        <p className="mt-3 flex-1 text-[11px] leading-relaxed text-[var(--ozer-text-on-dark)]">
          Thanks for the brief — I&apos;ll send the updated proposal by Friday.
        </p>
        <span className="text-[9px] text-[var(--ozer-text-on-dark-muted)]">Paste into any Mac app</span>
      </div>
    ),
  },
  {
    id: 'second-brain',
    width: 400,
    featureLabel: 'Second Brain',
    render: () => (
      <div className="flex h-full flex-col rounded-[1.75rem] border border-[color:var(--ozer-border-on-dark)] bg-[var(--ozer-plum-950)] p-4">
        <div className="flex items-center gap-2">
          <Brain className="h-4 w-4 text-[var(--ozer-coral-400)]" />
          <p className="text-xs font-semibold text-[var(--ozer-text-on-dark)]">Ask your second brain</p>
        </div>
        <div className="mt-3 rounded-xl border border-[color:var(--ozer-border-on-dark)] bg-[var(--ozer-plum-800)] px-3 py-2">
          <div className="flex items-center gap-2 text-[var(--ozer-text-on-dark-muted)]">
            <Search className="h-3 w-3 shrink-0" />
            <p className="truncate text-[11px]">
              What did we agree with Acme about the launch date?
            </p>
          </div>
        </div>
        <div className="mt-2 flex-1 rounded-xl border border-[color:var(--ozer-border-on-dark)] bg-[var(--ozer-plum-800)] p-3">
          <p className="text-[11px] leading-relaxed text-[var(--ozer-text-on-dark)]">
            Launch is set for <span className="font-semibold text-[var(--ozer-lime-400)]">14 March</span> —
            confirmed in your kickoff call and the follow-up email to Sarah.
          </p>
          <div className="mt-2 flex flex-wrap gap-1">
            {['Kickoff transcript', 'Email thread', 'Acme project'].map((source) => (
              <span
                key={source}
                className="rounded-md border border-[color:var(--ozer-border-on-dark)] bg-[var(--ozer-plum-900)] px-1.5 py-0.5 text-[9px] text-[var(--ozer-text-on-dark-muted)]"
              >
                {source}
              </span>
            ))}
          </div>
        </div>
        <div className="mt-2 flex items-center gap-1.5 text-[9px] text-[var(--ozer-text-on-dark-muted)]">
          <Sparkles className="h-3 w-3 text-[var(--ozer-accent)]" />
          Indexed from meetings, email, notes & projects
        </div>
      </div>
    ),
  },
  {
    id: 'dashboard-header',
    width: 380,
    render: () => (
      <div className="relative h-full overflow-hidden rounded-[1.75rem] border border-[color:var(--workspace-shell-border)] bg-[var(--ozer-plum-950)]">
        <Image
          src="/images/dashboard-header.webp"
          alt="Ozer workspace header and navigation"
          fill
          className="object-cover object-top"
          sizes="380px"
        />
      </div>
    ),
  },
  {
    id: 'invoicing',
    width: 300,
    featureLabel: 'Invoicing',
    render: () => (
      <div className="flex h-full flex-col rounded-[1.75rem] bg-[var(--ozer-sage-100)] p-4 text-[var(--ozer-text-on-light)]">
        <div className="flex items-center gap-2">
          <CreditCard className="h-4 w-4 text-[var(--ozer-plum-900)]" />
          <p className="text-sm font-semibold">Invoices</p>
        </div>
        <div className="mt-3 space-y-2">
          {[
            { client: 'Acme Co', amount: '£2,400', status: 'Sent' },
            { client: 'North Lane', amount: '£890', status: 'Paid' },
          ].map((row) => (
            <div
              key={row.client}
              className="flex items-center justify-between rounded-xl bg-[var(--ozer-white)] px-3 py-2 text-xs"
            >
              <span className="font-medium">{row.client}</span>
              <span className="font-semibold">{row.amount}</span>
            </div>
          ))}
        </div>
      </div>
    ),
  },
  {
    id: 'people',
    width: 260,
    featureLabel: 'Contacts',
    render: () => (
      <div className="flex h-full flex-col justify-between rounded-[1.75rem] bg-[var(--ozer-cream-100)] p-5 text-[var(--ozer-text-on-light)]">
        <Users className="h-5 w-5 text-[var(--ozer-accent)]" />
        <div>
          <p className="font-heading text-2xl font-bold">People</p>
          <p className="mt-1 text-sm text-[var(--ozer-text-on-light-muted)]">
            Clients, family & community in one rolodex
          </p>
        </div>
      </div>
    ),
  },
];

function featureBadgeLabel(card: ShowcaseCard): string | null {
  if (card.featureTags?.length) {
    return card.featureTags.join(' · ');
  }
  return card.featureLabel ?? null;
}

function ShowcaseCardShell({
  card,
  className,
}: {
  card: ShowcaseCard;
  className?: string;
}) {
  return (
    <div
      className={cn('relative h-[220px] shrink-0 sm:h-[240px]', className)}
      style={{ width: card.width }}
    >
      {card.render()}
      {featureBadgeLabel(card) ? (
        <span className="absolute bottom-3 left-3 z-10 rounded-md border border-[color:var(--ozer-border-on-dark)] bg-[var(--ozer-plum-950)] px-2 py-1 text-xs font-medium text-[var(--ozer-text-on-dark)]">
          {featureBadgeLabel(card)}
        </span>
      ) : null}
    </div>
  );
}

export function MarketingHeroShowcaseCarousel() {
  const reducedMotion = useReducedMotion() ?? false;
  const [paused, setPaused] = useState(false);
  const track = [...SHOWCASE_CARDS, ...SHOWCASE_CARDS];

  return (
    <div
      className="relative mt-16 w-screen max-w-[100vw] -translate-x-1/2 left-1/2 md:mt-20"
      aria-label="Product feature previews"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <div className="marketing-hero-fade-left" aria-hidden />
      <div className="marketing-hero-fade-right" aria-hidden />

      {reducedMotion ? (
        <div className="flex gap-4 overflow-x-auto px-6 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {SHOWCASE_CARDS.map((card) => (
            <ShowcaseCardShell key={card.id} card={card} />
          ))}
        </div>
      ) : (
        <div
          className="marketing-hero-marquee-track"
          data-paused={paused ? 'true' : 'false'}
        >
          {track.map((card, index) => (
            <ShowcaseCardShell key={`${card.id}-${index}`} card={card} />
          ))}
        </div>
      )}
    </div>
  );
}
