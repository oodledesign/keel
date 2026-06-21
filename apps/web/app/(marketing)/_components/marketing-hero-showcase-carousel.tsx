'use client';

import type { ReactNode } from 'react';
import { useState } from 'react';
import Image from 'next/image';

import { motion, useReducedMotion } from 'framer-motion';
import {
  CalendarDays,
  CheckCircle2,
  CreditCard,
  LayoutDashboard,
  Sparkles,
  Users,
} from 'lucide-react';

import { cn } from '@kit/ui/utils';

type ShowcaseCard = {
  id: string;
  width: number;
  featureLabel?: string;
  render: () => ReactNode;
};

const TODAY_PREVIEW = [
  { time: '09:00', text: 'School run prep', tag: 'Personal', color: '#7C3AED' },
  { time: '10:30', text: 'Review Acme proposal', tag: 'Business', color: '#2563EB' },
  { time: '15:00', text: 'Community event notes', tag: 'Community', color: '#2A9D8F' },
] as const;

const SHOWCASE_CARDS: ShowcaseCard[] = [
  {
    id: 'today',
    width: 300,
    featureLabel: 'Today view',
    render: () => (
      <div className="flex h-full flex-col rounded-[1.75rem] border border-white/10 bg-[#120f24] p-4">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-violet-200/80">
            Today in Ozer
          </p>
          <LayoutDashboard className="h-3.5 w-3.5 text-violet-200/70" />
        </div>
        <div className="space-y-2">
          {TODAY_PREVIEW.map((item) => (
            <div
              key={item.text}
              className="flex items-start gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-2.5 py-2"
            >
              <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-violet-300" />
              <div className="min-w-0">
                <p className="truncate text-xs text-violet-50/90">
                  <span className="font-mono text-[10px] text-violet-300/70">
                    {item.time}
                  </span>{' '}
                  {item.text}
                </p>
                <span className="mt-0.5 inline-flex items-center gap-1 rounded-md border border-white/10 px-1 py-0.5 text-[9px] text-white/70">
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
      <div className="flex h-full flex-col justify-between rounded-[1.75rem] bg-[linear-gradient(145deg,#dbeafe,#bfdbfe)] p-5 text-slate-900">
        <div className="flex -space-x-2">
          {['#7C3AED', '#2563EB', '#2A9D8F'].map((color) => (
            <span
              key={color}
              className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-white text-[10px] font-bold text-white"
              style={{ backgroundColor: color }}
            >
              K
            </span>
          ))}
        </div>
        <div>
          <p className="font-heading text-3xl font-bold">4</p>
          <p className="text-sm font-medium text-slate-700">Workspaces, one home</p>
          <p className="mt-1 text-xs text-slate-600">
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
      <div className="relative h-full overflow-hidden rounded-[1.75rem] border border-white/10 bg-[#0f0d1e]">
        <Image
          src="/images/dashboard.webp"
          alt="Ozer dashboard overview"
          fill
          className="object-cover object-top"
          sizes="420px"
        />
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#0f0d1e] via-[#0f0d1e]/80 to-transparent p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-violet-200/90">
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
      <div className="flex h-full flex-col rounded-[1.75rem] bg-[linear-gradient(145deg,#ede9fe,#ddd6fe)] p-4 text-slate-900">
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-violet-700/80">
          Pipeline
        </p>
        <div className="mt-3 grid flex-1 grid-cols-3 gap-2">
          {[
            { label: 'Lead', count: 4, tone: 'bg-violet-200/80' },
            { label: 'Proposal', count: 2, tone: 'bg-violet-300/70' },
            { label: 'Won', count: 1, tone: 'bg-teal-200/80' },
          ].map((col) => (
            <div key={col.label} className={cn('rounded-xl p-2', col.tone)}>
              <p className="text-[10px] font-semibold text-slate-700">{col.label}</p>
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
    render: () => (
      <div className="flex h-full flex-col rounded-[1.75rem] bg-[linear-gradient(145deg,#fef3c7,#fde68a)] p-4 text-slate-900">
        <div className="flex items-center gap-2">
          <CalendarDays className="h-4 w-4 text-amber-700" />
          <p className="text-sm font-semibold">This week</p>
        </div>
        <div className="mt-3 grid flex-1 grid-cols-7 gap-1">
          {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((day, index) => (
            <div
              key={`${day}-${index}`}
              className={cn(
                'flex aspect-square items-center justify-center rounded-lg text-[10px] font-medium',
                index === 2 ? 'bg-amber-600 text-white' : 'bg-white/60 text-amber-900/70',
              )}
            >
              {day}
            </div>
          ))}
        </div>
        <p className="mt-2 text-xs text-amber-900/80">3 events across workspaces</p>
      </div>
    ),
  },
  {
    id: 'dashboard-header',
    width: 380,
    render: () => (
      <div className="relative h-full overflow-hidden rounded-[1.75rem] border border-white/10 bg-[#0f0d1e]">
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
      <div className="flex h-full flex-col rounded-[1.75rem] bg-[linear-gradient(145deg,#ccfbf1,#99f6e4)] p-4 text-slate-900">
        <div className="flex items-center gap-2">
          <CreditCard className="h-4 w-4 text-teal-700" />
          <p className="text-sm font-semibold">Invoices</p>
        </div>
        <div className="mt-3 space-y-2">
          {[
            { client: 'Acme Co', amount: '£2,400', status: 'Sent' },
            { client: 'North Lane', amount: '£890', status: 'Paid' },
          ].map((row) => (
            <div
              key={row.client}
              className="flex items-center justify-between rounded-xl bg-white/70 px-3 py-2 text-xs"
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
      <div className="flex h-full flex-col justify-between rounded-[1.75rem] bg-[linear-gradient(145deg,#fce7f3,#fbcfe8)] p-5 text-slate-900">
        <Users className="h-5 w-5 text-pink-700" />
        <div>
          <p className="font-heading text-2xl font-bold">People</p>
          <p className="mt-1 text-sm text-slate-700">
            Clients, family & community in one rolodex
          </p>
        </div>
      </div>
    ),
  },
  {
    id: 'ai-planner',
    width: 280,
    featureLabel: 'AI Planner',
    render: () => (
      <div className="flex h-full flex-col justify-between rounded-[1.75rem] border border-violet-300/20 bg-[linear-gradient(145deg,#1e1b4b,#312e81)] p-5">
        <Sparkles className="h-5 w-5 text-violet-300" />
        <div>
          <p className="font-heading text-lg font-semibold text-white">AI planner</p>
          <p className="mt-1 text-sm text-violet-100/80">
            Priorities pulled from every workspace into one Today view
          </p>
        </div>
      </div>
    ),
  },
];

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
      {card.featureLabel ? (
        <span className="absolute bottom-3 left-3 z-10 rounded-md border border-white/10 bg-black/50 px-2 py-1 text-xs font-medium text-white/80 backdrop-blur-sm">
          {card.featureLabel}
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
      className="relative mt-14 w-screen max-w-[100vw] -translate-x-1/2 left-1/2 sm:mt-16"
      aria-label="Product feature previews"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-16 bg-gradient-to-r from-[#05050b] to-transparent sm:w-28" />
      <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-16 bg-gradient-to-l from-[#080711] to-transparent sm:w-28" />

      {reducedMotion ? (
        <div className="flex gap-4 overflow-x-auto px-6 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {SHOWCASE_CARDS.map((card) => (
            <ShowcaseCardShell key={card.id} card={card} />
          ))}
        </div>
      ) : (
        <motion.div
          className="flex w-max gap-4 px-6"
          animate={paused ? undefined : { x: ['0%', '-50%'] }}
          transition={{
            x: {
              repeat: Infinity,
              repeatType: 'loop',
              duration: 48,
              ease: 'linear',
            },
          }}
        >
          {track.map((card, index) => (
            <ShowcaseCardShell key={`${card.id}-${index}`} card={card} />
          ))}
        </motion.div>
      )}
    </div>
  );
}
