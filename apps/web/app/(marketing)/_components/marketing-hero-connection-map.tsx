'use client';

import { useSyncExternalStore } from 'react';

import Link from 'next/link';

import { motion, useReducedMotion } from 'framer-motion';
import type { LucideIcon } from 'lucide-react';
import {
  Activity,
  Brain,
  CalendarDays,
  Check,
  Contact,
  CreditCard,
  FolderKanban,
  Kanban,
  LayoutDashboard,
  ListChecks,
  Mail,
  Search,
  Sparkles,
  StickyNote,
} from 'lucide-react';

import { cn } from '@kit/ui/utils';

import { marketingHeroEase } from '~/lib/marketing/marketing-ui';
import {
  type MarketingViewerContext,
  formatMarketingDashboardGreeting,
} from '~/lib/marketing/marketing-viewer';

/* ──────────────────────────────────────────────────────────────
 * Map data — launch-scope capabilities feed the dashboard screen below
 * via SVG connection lines.
 * All coordinates are percentages of the desktop map container
 * so the HTML nodes and the SVG line layer stay aligned.
 * ────────────────────────────────────────────────────────────── */

type FeatureNodeDef = {
  id: string;
  label: string;
  icon: LucideIcon;
  href: string;
  x: number;
  target: number;
  /** Staggered sub-row (0 = upper, 1 = lower) for an organic map feel */
  row: 0 | 1;
};

const FEATURE_NODES: readonly FeatureNodeDef[] = [
  {
    id: 'clients',
    label: 'Clients',
    icon: Contact,
    href: '/features/pipeline',
    x: 8,
    target: 16,
    row: 0,
  },
  {
    id: 'projects',
    label: 'Projects',
    icon: FolderKanban,
    href: '/features/project-management',
    x: 18.5,
    target: 24,
    row: 1,
  },
  {
    id: 'invoicing',
    label: 'Invoicing',
    icon: CreditCard,
    href: '/features/invoicing',
    x: 29,
    target: 31,
    row: 0,
  },
  {
    id: 'email',
    label: 'Email',
    icon: Mail,
    href: '/features/email-assistant',
    x: 39.5,
    target: 40,
    row: 1,
  },
  {
    id: 'planner',
    label: 'Planner',
    icon: Sparkles,
    href: '/features/planner',
    x: 50,
    target: 50,
    row: 0,
  },
  {
    id: 'second-brain',
    label: 'Second Brain',
    icon: Brain,
    href: '/features/second-brain',
    x: 60.5,
    target: 60,
    row: 1,
  },
  {
    id: 'activity',
    label: 'Activity',
    icon: Activity,
    href: '/features/activity',
    x: 71,
    target: 69,
    row: 0,
  },
  {
    id: 'notes',
    label: 'Notes',
    icon: StickyNote,
    href: '/features/notes',
    x: 81.5,
    target: 76,
    row: 1,
  },
  {
    id: 'pipeline',
    label: 'Pipeline',
    icon: Kanban,
    href: '/features/pipeline',
    x: 92,
    target: 84,
    row: 0,
  },
] as const;

/**
 * Desktop connector-region geometry. The region above the screen has a
 * fixed pixel height (REGION_H) holding the node rows and the SVG line
 * layer. The SVG viewBox is 1144 × REGION_H with
 * preserveAspectRatio="none": vertical units always map 1:1 to pixels,
 * horizontal units scale with the container, so lines stay glued to the
 * nodes and to the screen's top edge at any width.
 */
const VB_W = 1144;
const REGION_H = 168;
/** top offsets for the two staggered feature-chip sub-rows */
const CHIP_ROW_TOP = [8, 44] as const;
/** y where lines leave each chip sub-row (chip height ≈ 30px) */
const CHIP_LINE_START = [40, 76] as const;

const toX = (percent: number) => (percent / 100) * VB_W;

function featurePath(node: FeatureNodeDef) {
  const x = toX(node.x);
  const t = toX(node.target);
  const start = CHIP_LINE_START[node.row];
  return `M ${x} ${start} C ${x} ${start + 34}, ${t} ${REGION_H - 26}, ${t} ${REGION_H}`;
}

/* ──────────────────────────────────────────────────────────────
 * Connection lines
 * ────────────────────────────────────────────────────────────── */

function ConnectionLines({
  animate,
  live,
}: {
  animate: boolean;
  live: boolean;
}) {
  // Identical SSR markup for all users; reduced motion collapses the draw
  // to zero duration rather than changing the rendered tree.
  const draw = (delay: number, duration: number) => ({
    initial: { pathLength: 0, opacity: 0 },
    animate: { pathLength: 1, opacity: 1 },
    transition: animate
      ? { duration, delay, ease: marketingHeroEase }
      : { duration: 0, delay: 0 },
  });

  return (
    <svg
      className="pointer-events-none absolute inset-0 z-0 h-full w-full text-[var(--ozer-plum-alpha-18)] dark:text-[var(--ozer-on-dark-alpha-08)]"
      viewBox={`0 0 ${VB_W} ${REGION_H}`}
      preserveAspectRatio="none"
      aria-hidden
    >
      {FEATURE_NODES.map((node, index) => {
        const d = featurePath(node);
        return (
          <g key={node.id}>
            <motion.path
              d={d}
              fill="none"
              stroke="currentColor"
              strokeWidth="1.25"
              vectorEffect="non-scaling-stroke"
              {...draw(0.5 + index * 0.05, 0.7)}
            />
            {live && index % 3 === 1 ? (
              <circle
                r="3.5"
                fill="var(--ozer-accent)"
                style={{
                  filter: 'drop-shadow(0 0 2px var(--ozer-coral-alpha-45))',
                }}
              >
                <animateMotion
                  dur="5s"
                  repeatCount="indefinite"
                  begin={`${1.4 + index * 0.6}s`}
                  path={d}
                />
              </circle>
            ) : null}
          </g>
        );
      })}
    </svg>
  );
}

/* ──────────────────────────────────────────────────────────────
 * Nodes
 * ────────────────────────────────────────────────────────────── */

function FeatureNodeChip({ node }: { node: FeatureNodeDef }) {
  const Icon = node.icon;

  return (
    <Link
      href={node.href}
      className="flex items-center gap-1.5 rounded-full border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] px-2.5 py-1.5 whitespace-nowrap shadow-[0_4px_14px_var(--ozer-plum-alpha-08)] transition-[border-color,background-color] duration-200 hover:border-[var(--ozer-accent)]/35 hover:bg-[var(--workspace-shell-sidebar-accent)]"
    >
      <Icon className="h-3 w-3 text-[var(--ozer-accent)]" aria-hidden />
      <span className="text-[10px] font-semibold text-[var(--workspace-shell-text)] lg:text-[11px]">
        {node.label}
      </span>
    </Link>
  );
}

/* ──────────────────────────────────────────────────────────────
 * Dashboard screen mockup — light personal home (matches OzerDashboard).
 * ────────────────────────────────────────────────────────────── */

const SIDEBAR_NAV = [
  { label: 'Home', icon: LayoutDashboard, active: true },
  { label: 'Planner', icon: CalendarDays, active: false },
  { label: 'Tasks', icon: ListChecks, active: false },
  { label: 'People', icon: Contact, active: false },
  { label: 'Notes', icon: StickyNote, active: false },
  { label: 'Activity', icon: Activity, active: false },
] as const;

const SIDEBAR_SPACES = [
  { label: 'Personal', color: 'var(--ozer-accent)' },
  { label: 'Business', color: 'var(--ozer-sky-200)' },
  { label: 'Family', color: 'var(--ozer-sage-500)' },
] as const;

const FOCUS_TASKS = [
  { text: 'Send Acme proposal', space: 'Business', done: false },
  { text: 'Book boiler service', space: 'Personal', done: false },
  { text: 'School pick-up reminder', space: 'Family', done: true },
] as const;

const UPCOMING_TASKS = [
  { text: 'Chase invoice #204', space: 'Business' },
  { text: 'Plan weekend meals', space: 'Family' },
] as const;

const PEOPLE_ROWS = [
  { name: 'Sam Rivera', label: 'Catch-up due Fri' },
  { name: 'Maya Chen', label: 'Birthday in 4 days' },
] as const;

const MY_DAY = [
  { time: '09:00', text: 'School run', space: 'Family' },
  { time: '10:30', text: 'Acme kickoff', space: 'Business' },
  { time: '14:00', text: 'Deep work block', space: 'Personal' },
] as const;

const NOTE_CARDS = [
  { title: 'Acme kickoff — decisions', space: 'Business' },
  { title: 'Weekend trip ideas', space: 'Personal' },
] as const;

const WORKSPACE_CARDS = [
  { name: 'Business', stats: ['12 open', '£4.8k'] },
  { name: 'Family', stats: ['3 tasks', '2 events'] },
] as const;

function DashboardScreen({
  animate,
  live,
  viewer,
}: {
  animate: boolean;
  live: boolean;
  viewer: MarketingViewerContext;
}) {
  const reveal = (delay: number) => ({
    initial: { opacity: 0, y: 10 },
    whileInView: { opacity: 1, y: 0 },
    viewport: { once: true, margin: '-60px' },
    transition: animate
      ? { duration: 0.45, delay, ease: marketingHeroEase }
      : { duration: 0, delay: 0 },
  });

  const greetingLine = formatMarketingDashboardGreeting(
    viewer.greeting,
    viewer.firstName,
  );

  return (
    <div className="overflow-hidden rounded-2xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-canvas)] shadow-[0_24px_80px_var(--ozer-plum-alpha-12)]">
      {/* Browser chrome */}
      <div className="flex items-center gap-3 border-b border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] px-4 py-2.5">
        <span className="flex gap-1.5" aria-hidden>
          <span className="h-2.5 w-2.5 rounded-full bg-[var(--ozer-coral-400)]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[var(--ozer-lime-400)]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[var(--ozer-sage-500)]" />
        </span>
        <span className="flex items-center gap-1.5 rounded-md bg-[var(--workspace-shell-sidebar-accent)] px-3 py-1 text-[10px] text-[var(--workspace-shell-text-muted)]">
          <Search className="h-2.5 w-2.5" aria-hidden />
          ozer.so/home
        </span>
      </div>

      <div className="flex">
        {/* Sidebar — coral to separate from the cream content */}
        <div className="hidden w-[150px] shrink-0 flex-col gap-4 bg-[var(--ozer-coral-500)] p-3.5 sm:flex lg:w-[170px]">
          <div className="space-y-1">
            {SIDEBAR_NAV.map((item) => (
              <div
                key={item.label}
                className={cn(
                  'flex items-center gap-2 rounded-lg px-2 py-1.5 text-[11px] font-medium',
                  item.active
                    ? 'bg-[var(--ozer-cream-50)] text-[var(--ozer-coral-600)]'
                    : 'text-[var(--ozer-cream-50)]/90',
                )}
              >
                <item.icon className="h-3 w-3" aria-hidden />
                {item.label}
              </div>
            ))}
          </div>
          <div>
            <p className="px-2 text-[9px] font-semibold tracking-[0.12em] text-[var(--ozer-cream-50)]/70 uppercase">
              Workspaces
            </p>
            <div className="mt-1.5 space-y-1">
              {SIDEBAR_SPACES.map((space) => (
                <div
                  key={space.label}
                  className="flex items-center gap-2 rounded-lg px-2 py-1 text-[11px] text-[var(--ozer-cream-50)]/90"
                >
                  <span
                    className="h-1.5 w-1.5 rounded-full ring-1 ring-[var(--ozer-cream-50)]/40"
                    style={{ backgroundColor: space.color }}
                  />
                  {space.label}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Main — personal dashboard layout */}
        <div className="min-w-0 flex-1 bg-[var(--workspace-shell-canvas)] p-4 lg:p-5">
          <div className="flex items-baseline justify-between gap-3">
            <div>
              <p className="font-heading text-sm font-bold text-[var(--workspace-shell-text)] lg:text-base">
                {greetingLine}
              </p>
              <p className="text-[10px] text-[var(--workspace-shell-text-muted)]">
                {viewer.dateLabel}
              </p>
            </div>
            <span
              className={cn(
                'rounded-full bg-[var(--ozer-accent-subtle)] px-2 py-0.5 text-[9px] font-semibold text-[var(--ozer-coral-600)]',
                live && 'animate-pulse',
              )}
            >
              Live across spaces
            </span>
          </div>

          <div className="mt-3 grid gap-3 lg:grid-cols-5">
            {/* Left stack: focus, upcoming, people */}
            <div className="flex flex-col gap-3 lg:col-span-3">
              <motion.div
                className="rounded-xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] p-3"
                {...reveal(0.05)}
              >
                <p className="mb-2 text-[10px] font-semibold tracking-[0.12em] text-[var(--workspace-shell-text-muted)] uppercase">
                  Today&apos;s Focus
                </p>
                <div className="space-y-1.5">
                  {FOCUS_TASKS.map((task) => (
                    <div key={task.text} className="flex items-center gap-2">
                      <span
                        className={cn(
                          'flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded border',
                          task.done
                            ? 'border-[var(--ozer-accent)] bg-[var(--ozer-accent)]'
                            : 'border-[color:var(--workspace-shell-border)]',
                        )}
                      >
                        {task.done ? (
                          <Check
                            className="h-2.5 w-2.5 text-[var(--ozer-cream-50)]"
                            strokeWidth={3}
                            aria-hidden
                          />
                        ) : null}
                      </span>
                      <span
                        className={cn(
                          'min-w-0 flex-1 truncate text-[11px]',
                          task.done
                            ? 'text-[var(--workspace-shell-text-muted)] line-through'
                            : 'text-[var(--workspace-shell-text)]',
                        )}
                      >
                        {task.text}
                      </span>
                      <span className="shrink-0 text-[9px] text-[var(--workspace-shell-text-muted)]">
                        {task.space}
                      </span>
                    </div>
                  ))}
                </div>
              </motion.div>

              <motion.div
                className="rounded-xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] p-3"
                {...reveal(0.1)}
              >
                <p className="mb-2 text-[10px] font-semibold tracking-[0.12em] text-[var(--workspace-shell-text-muted)] uppercase">
                  Upcoming
                </p>
                <div className="space-y-1.5">
                  {UPCOMING_TASKS.map((task) => (
                    <div
                      key={task.text}
                      className="flex items-center justify-between gap-2"
                    >
                      <span className="truncate text-[11px] text-[var(--workspace-shell-text)]">
                        {task.text}
                      </span>
                      <span className="shrink-0 text-[9px] text-[var(--workspace-shell-text-muted)]">
                        {task.space}
                      </span>
                    </div>
                  ))}
                </div>
              </motion.div>

              <motion.div
                className="rounded-xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] p-3"
                {...reveal(0.14)}
              >
                <p className="mb-2 text-[10px] font-semibold tracking-[0.12em] text-[var(--workspace-shell-text-muted)] uppercase">
                  People focus
                </p>
                <div className="space-y-1.5">
                  {PEOPLE_ROWS.map((person) => (
                    <div key={person.name} className="flex items-center gap-2">
                      <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-[var(--ozer-accent-subtle)] text-[9px] font-semibold text-[var(--ozer-coral-600)]">
                        {person.name.slice(0, 1)}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-[11px] font-medium text-[var(--workspace-shell-text)]">
                          {person.name}
                        </p>
                        <p className="truncate text-[9px] text-[var(--workspace-shell-text-muted)]">
                          {person.label}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            </div>

            {/* My Day */}
            <motion.div
              className="rounded-xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] p-3 lg:col-span-2"
              {...reveal(0.08)}
            >
              <div className="mb-2 flex items-center justify-between">
                <p className="text-[10px] font-semibold tracking-[0.12em] text-[var(--workspace-shell-text-muted)] uppercase">
                  My Day
                </p>
                <Sparkles
                  className="h-3 w-3 text-[var(--ozer-accent)]"
                  aria-hidden
                />
              </div>
              <div className="space-y-1.5">
                {MY_DAY.map((event) => (
                  <div
                    key={event.text}
                    className="flex items-start gap-2 rounded-lg bg-[var(--workspace-shell-sidebar-accent)] px-2 py-1.5"
                  >
                    <span className="w-9 shrink-0 font-mono text-[9px] font-semibold text-[var(--ozer-accent)]">
                      {event.time}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-[11px] font-medium text-[var(--workspace-shell-text)]">
                        {event.text}
                      </p>
                      <p className="text-[9px] text-[var(--workspace-shell-text-muted)]">
                        {event.space}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>

            {/* Notes — half width */}
            <motion.div
              className="rounded-xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] p-3 lg:col-span-2"
              {...reveal(0.18)}
            >
              <div className="mb-2 flex items-center justify-between">
                <p className="text-[10px] font-semibold tracking-[0.12em] text-[var(--workspace-shell-text-muted)] uppercase">
                  Recent notes
                </p>
                <StickyNote
                  className="h-3 w-3 text-[var(--ozer-accent)]"
                  aria-hidden
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                {NOTE_CARDS.map((note) => (
                  <div
                    key={note.title}
                    className="rounded-lg border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] p-2"
                  >
                    <p className="line-clamp-2 text-[10px] font-semibold text-[var(--workspace-shell-text)]">
                      {note.title}
                    </p>
                    <p className="mt-1 text-[9px] text-[var(--workspace-shell-text-muted)]">
                      {note.space}
                    </p>
                  </div>
                ))}
              </div>
            </motion.div>

            {/* Workspace overview */}
            <motion.div
              className="rounded-xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] p-3 lg:col-span-3"
              {...reveal(0.22)}
            >
              <p className="mb-2 text-[10px] font-semibold tracking-[0.12em] text-[var(--workspace-shell-text-muted)] uppercase">
                Workspace overview
              </p>
              <div className="grid grid-cols-2 gap-2">
                {WORKSPACE_CARDS.map((card) => (
                  <div
                    key={card.name}
                    className="rounded-lg border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] p-2.5"
                  >
                    <p className="text-[11px] font-semibold text-[var(--workspace-shell-text)]">
                      {card.name}
                    </p>
                    <div className="mt-1.5 flex gap-2">
                      {card.stats.map((stat) => (
                        <span
                          key={stat}
                          className="rounded-md bg-[var(--workspace-shell-panel)] px-1.5 py-0.5 text-[9px] text-[var(--workspace-shell-text-muted)]"
                        >
                          {stat}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────
 * Desktop map — absolute nodes over an SVG line layer
 * ────────────────────────────────────────────────────────────── */

function DesktopConnectionMap({
  animate,
  live,
  viewer,
}: {
  animate: boolean;
  live: boolean;
  viewer: MarketingViewerContext;
}) {
  const nodeReveal = (delay: number) => ({
    initial: { opacity: 0, y: -8 },
    animate: { opacity: 1, y: 0 },
    transition: animate
      ? { duration: 0.4, delay, ease: marketingHeroEase }
      : { duration: 0, delay: 0 },
  });

  // Gentle idle float — client-only (`live`) so SSR markup stays stable.
  const float = (delay: number) =>
    live
      ? {
          animate: { y: [0, -3, 0] },
          transition: {
            duration: 6,
            delay,
            repeat: Infinity,
            ease: 'easeInOut' as const,
          },
        }
      : {};

  return (
    <div className="mx-auto w-full max-w-[71.5rem]" aria-hidden>
      {/* Connector region — launch capabilities + lines above the screen */}
      <div className="relative" style={{ height: REGION_H }}>
        <ConnectionLines animate={animate} live={live} />

        {/* Feature chips — two staggered sub-rows */}
        {FEATURE_NODES.map((node, index) => (
          <motion.div
            key={node.id}
            className="absolute z-10 -translate-x-1/2"
            style={{ left: `${node.x}%`, top: CHIP_ROW_TOP[node.row] }}
            {...nodeReveal(0.3 + index * 0.04)}
          >
            <motion.div {...float(0.4 + index * 0.5)}>
              <FeatureNodeChip node={node} />
            </motion.div>
          </motion.div>
        ))}
      </div>

      {/* Dashboard screen — one large orb behind the mockup */}
      <motion.div
        className="relative z-10 mx-auto w-full"
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={
          animate
            ? { duration: 0.6, delay: 0.55, ease: marketingHeroEase }
            : { duration: 0, delay: 0 }
        }
      >
        <div
          aria-hidden
          className="pointer-events-none absolute top-1/2 left-1/2 -z-10 h-[min(120%,56rem)] w-[min(140%,64rem)] -translate-x-1/2 -translate-y-[42%]"
        >
          <div className="h-full w-full rounded-full bg-[radial-gradient(circle_at_center,color-mix(in_srgb,var(--ozer-coral-400)_58%,transparent)_0%,color-mix(in_srgb,var(--ozer-coral-500)_32%,transparent)_38%,transparent_72%)] blur-3xl" />
        </div>
        <DashboardScreen animate={animate} live={live} viewer={viewer} />
      </motion.div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────
 * Mobile map — stacked chips, short connector, screen
 * ────────────────────────────────────────────────────────────── */

function MobileConnector({ live }: { live: boolean }) {
  const d = 'M 50 0 L 50 100';
  const dLeft = 'M 20 0 C 20 55, 50 45, 50 100';
  const dRight = 'M 80 0 C 80 55, 50 45, 50 100';

  return (
    <svg
      className="mx-auto h-12 w-40 text-[var(--ozer-plum-alpha-18)] dark:text-[var(--ozer-on-dark-alpha-08)]"
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      aria-hidden
    >
      {[dLeft, d, dRight].map((path) => (
        <path
          key={path}
          d={path}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          vectorEffect="non-scaling-stroke"
        />
      ))}
      {live ? (
        <circle r="2.5" fill="var(--ozer-accent)">
          <animateMotion dur="2.8s" repeatCount="indefinite" path={d} />
        </circle>
      ) : null}
    </svg>
  );
}

function MobileConnectionMap({
  animate,
  live,
  viewer,
}: {
  animate: boolean;
  live: boolean;
  viewer: MarketingViewerContext;
}) {
  return (
    <div>
      <div className="flex flex-wrap justify-center gap-1.5" aria-hidden>
        {FEATURE_NODES.map((node) => (
          <FeatureNodeChip key={node.id} node={node} />
        ))}
      </div>

      <MobileConnector live={live} />

      <div className="relative">
        <div
          aria-hidden
          className="pointer-events-none absolute top-1/2 left-1/2 -z-10 h-[min(110%,36rem)] w-[min(130%,40rem)] -translate-x-1/2 -translate-y-[45%]"
        >
          <div className="h-full w-full rounded-full bg-[radial-gradient(circle_at_center,color-mix(in_srgb,var(--ozer-coral-400)_55%,transparent)_0%,color-mix(in_srgb,var(--ozer-coral-500)_28%,transparent)_40%,transparent_72%)] blur-3xl" />
        </div>
        <DashboardScreen animate={animate} live={live} viewer={viewer} />
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────
 * Public component
 * ────────────────────────────────────────────────────────────── */

const emptySubscribe = () => () => {};

/** False during SSR/hydration, true after — without a state cascade. */
function useHydrated() {
  return useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  );
}

export function MarketingHeroConnectionMap({
  viewer,
}: {
  viewer: MarketingViewerContext;
}) {
  const reducedMotion = useReducedMotion() ?? false;
  const animate = !reducedMotion;

  // Looping extras (SMIL dots, idle float) mount client-side only so the
  // server and client render identical markup regardless of motion prefs.
  const live = useHydrated() && !reducedMotion;

  return (
    <div
      className="relative mt-12 md:mt-16"
      role="img"
      aria-label="Map of Ozer launch capabilities — clients, projects, invoicing, pipeline, email, planner, activity, notes, and second brain — all connected to one dashboard."
    >
      <div className="md:hidden">
        <MobileConnectionMap animate={animate} live={live} viewer={viewer} />
      </div>
      <div className="hidden md:block">
        <DesktopConnectionMap animate={animate} live={live} viewer={viewer} />
      </div>
    </div>
  );
}
