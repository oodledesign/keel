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
 * Dashboard screen mockup — fixed dark app frame, colour-blocked
 * cards. Built in code so it stays crisp and animates.
 * ────────────────────────────────────────────────────────────── */

const SIDEBAR_NAV = [
  { label: 'Today', icon: LayoutDashboard, active: true },
  { label: 'Planner', icon: CalendarDays, active: false },
  { label: 'Tasks', icon: ListChecks, active: false },
  { label: 'Activity', icon: Activity, active: false },
  { label: 'Notes', icon: StickyNote, active: false },
  { label: 'Finances', icon: CreditCard, active: false },
] as const;

const SIDEBAR_SPACES = [
  { label: 'Personal', color: 'var(--ozer-accent)' },
  { label: 'Business', color: 'var(--ozer-sky-200)' },
  { label: 'Family', color: 'var(--ozer-sage-500)' },
] as const;

const PLANNER_BLOCKS = [
  {
    time: '09:00',
    text: 'School run, then deep work',
    tag: 'Personal',
    bg: 'var(--ozer-sage-100)',
    dot: 'var(--ozer-sage-500)',
  },
  {
    time: '10:30',
    text: 'Acme kickoff call',
    tag: 'Business',
    bg: 'var(--ozer-coral-50)',
    dot: 'var(--ozer-accent)',
  },
  {
    time: '14:00',
    text: 'Invoice follow-up',
    tag: 'Business',
    bg: 'var(--ozer-sky-100)',
    dot: 'var(--ozer-info)',
  },
] as const;

const TASK_ROWS = [
  { text: 'Send Acme proposal', done: true },
  { text: 'Chase invoice #204', done: false },
  { text: 'Book boiler service', done: false },
] as const;

const FINANCE_BARS = [34, 55, 42, 70, 58, 86] as const;

function DashboardScreen({
  animate,
  live,
}: {
  animate: boolean;
  live: boolean;
}) {
  const reveal = (delay: number) => ({
    initial: { opacity: 0, y: 10 },
    whileInView: { opacity: 1, y: 0 },
    viewport: { once: true, margin: '-60px' },
    transition: animate
      ? { duration: 0.45, delay, ease: marketingHeroEase }
      : { duration: 0, delay: 0 },
  });

  return (
    <div className="overflow-hidden rounded-2xl border border-[color:var(--ozer-border-on-dark-strong)] bg-[var(--ozer-plum-950)] shadow-[0_24px_80px_var(--ozer-plum-alpha-18)]">
      {/* Browser chrome */}
      <div className="flex items-center gap-3 border-b border-[color:var(--ozer-border-on-dark)] px-4 py-2.5">
        <span className="flex gap-1.5" aria-hidden>
          <span className="h-2.5 w-2.5 rounded-full bg-[var(--ozer-coral-400)]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[var(--ozer-lime-400)]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[var(--ozer-sage-500)]" />
        </span>
        <span className="flex items-center gap-1.5 rounded-md bg-[var(--ozer-plum-800)] px-3 py-1 text-[10px] text-[var(--ozer-text-on-dark-muted)]">
          <Search className="h-2.5 w-2.5" aria-hidden />
          ozer.so/home
        </span>
      </div>

      <div className="flex">
        {/* Sidebar */}
        <div className="hidden w-[150px] shrink-0 flex-col gap-4 border-r border-[color:var(--ozer-border-on-dark)] p-3.5 sm:flex lg:w-[170px]">
          <div className="space-y-1">
            {SIDEBAR_NAV.map((item) => (
              <div
                key={item.label}
                className={cn(
                  'flex items-center gap-2 rounded-lg px-2 py-1.5 text-[11px] font-medium',
                  item.active
                    ? 'bg-[var(--ozer-accent-subtle)] text-[var(--ozer-coral-400)]'
                    : 'text-[var(--ozer-text-on-dark-muted)]',
                )}
              >
                <item.icon className="h-3 w-3" aria-hidden />
                {item.label}
              </div>
            ))}
          </div>
          <div>
            <p className="px-2 text-[9px] font-semibold tracking-[0.12em] text-[var(--ozer-text-on-dark-muted)] uppercase">
              Workspaces
            </p>
            <div className="mt-1.5 space-y-1">
              {SIDEBAR_SPACES.map((space) => (
                <div
                  key={space.label}
                  className="flex items-center gap-2 rounded-lg px-2 py-1 text-[11px] text-[var(--ozer-text-on-dark-muted)]"
                >
                  <span
                    className="h-1.5 w-1.5 rounded-full"
                    style={{ backgroundColor: space.color }}
                  />
                  {space.label}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Main content */}
        <div className="min-w-0 flex-1 bg-[var(--ozer-plum-900)] p-4 lg:p-5">
          <div className="flex items-baseline justify-between gap-3">
            <p className="font-heading text-sm font-bold text-[var(--ozer-text-on-dark)] lg:text-base">
              Today
            </p>
            <p className="text-[10px] text-[var(--ozer-text-on-dark-muted)]">
              Tasks and plans from every workspace
            </p>
          </div>

          <div className="mt-3 grid gap-3 lg:grid-cols-5">
            {/* Planner */}
            <motion.div
              className="relative rounded-xl border border-[color:var(--ozer-border-on-dark)] bg-[var(--ozer-plum-950)] p-3 lg:col-span-3"
              {...reveal(0.05)}
            >
              <div className="mb-2 flex items-center justify-between">
                <p className="text-[10px] font-semibold tracking-[0.12em] text-[var(--ozer-text-on-dark-muted)] uppercase">
                  Planner
                </p>
                <Sparkles
                  className="h-3 w-3 text-[var(--ozer-coral-400)]"
                  aria-hidden
                />
              </div>
              <div className="relative space-y-1.5">
                {PLANNER_BLOCKS.map((block) => (
                  <div
                    key={block.text}
                    className="flex items-center gap-2 rounded-lg px-2.5 py-2"
                    style={{ backgroundColor: block.bg }}
                  >
                    <span className="font-mono text-[9px] font-semibold text-[var(--ozer-plum-600)]">
                      {block.time}
                    </span>
                    <span className="min-w-0 truncate text-[11px] font-medium text-[var(--ozer-text-on-light)]">
                      {block.text}
                    </span>
                    <span className="ml-auto flex shrink-0 items-center gap-1 text-[9px] text-[var(--ozer-plum-600)]">
                      <span
                        className="h-1 w-1 rounded-full"
                        style={{ backgroundColor: block.dot }}
                      />
                      {block.tag}
                    </span>
                  </div>
                ))}
                {/* "Now" line */}
                <div
                  className="pointer-events-none absolute inset-x-0 top-[52%] flex items-center gap-1"
                  aria-hidden
                >
                  <span
                    className={cn(
                      'h-1.5 w-1.5 rounded-full bg-[var(--ozer-accent)]',
                      live && 'animate-pulse',
                    )}
                  />
                  <span className="h-px flex-1 bg-[var(--ozer-accent)] opacity-70" />
                </div>
              </div>
            </motion.div>

            {/* Tasks */}
            <motion.div
              className="rounded-xl border border-[color:var(--ozer-border-on-dark)] bg-[var(--ozer-plum-950)] p-3 lg:col-span-2"
              {...reveal(0.12)}
            >
              <p className="mb-2 text-[10px] font-semibold tracking-[0.12em] text-[var(--ozer-text-on-dark-muted)] uppercase">
                Tasks
              </p>
              <div className="space-y-1.5">
                {TASK_ROWS.map((task) => (
                  <div key={task.text} className="flex items-center gap-2">
                    <span
                      className={cn(
                        'flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded border',
                        task.done
                          ? 'border-[var(--ozer-accent)] bg-[var(--ozer-accent)]'
                          : 'border-[color:var(--ozer-border-on-dark-strong)]',
                      )}
                    >
                      {task.done ? (
                        <Check
                          className="h-2.5 w-2.5 text-[var(--ozer-plum-950)]"
                          strokeWidth={3}
                          aria-hidden
                        />
                      ) : null}
                    </span>
                    <span
                      className={cn(
                        'truncate text-[11px]',
                        task.done
                          ? 'text-[var(--ozer-text-on-dark-muted)] line-through'
                          : 'text-[var(--ozer-text-on-dark)]',
                      )}
                    >
                      {task.text}
                    </span>
                  </div>
                ))}
              </div>
            </motion.div>

            {/* Notes */}
            <motion.div
              className="rounded-xl bg-[var(--ozer-lime-100)] p-3 lg:col-span-2"
              {...reveal(0.18)}
            >
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-semibold tracking-[0.12em] text-[var(--ozer-plum-600)] uppercase">
                  Notes
                </p>
                <StickyNote
                  className="h-3 w-3 text-[var(--ozer-plum-600)]"
                  aria-hidden
                />
              </div>
              <p className="mt-1.5 text-[11px] font-semibold text-[var(--ozer-text-on-light)]">
                Acme kickoff — decisions
              </p>
              <div className="mt-1.5 space-y-1" aria-hidden>
                <span className="block h-1 w-11/12 rounded-full bg-[var(--ozer-plum-alpha-12)]" />
                <span className="block h-1 w-4/5 rounded-full bg-[var(--ozer-plum-alpha-12)]" />
                <span className="block h-1 w-3/5 rounded-full bg-[var(--ozer-plum-alpha-12)]" />
              </div>
            </motion.div>

            {/* Finances */}
            <motion.div
              className="rounded-xl bg-[var(--ozer-sky-100)] p-3 lg:col-span-3"
              {...reveal(0.24)}
            >
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-semibold tracking-[0.12em] text-[var(--ozer-plum-600)] uppercase">
                  Finances
                </p>
                <span className="rounded-full bg-[var(--ozer-plum-950)] px-2 py-0.5 text-[9px] font-semibold text-[var(--ozer-cream-50)]">
                  Invoice #204 paid
                </span>
              </div>
              <div className="mt-2 flex items-end justify-between gap-3">
                <div>
                  <p className="font-heading text-lg font-bold text-[var(--ozer-text-on-light)]">
                    £4,820
                  </p>
                  <p className="text-[9px] text-[var(--ozer-plum-600)]">
                    Invoiced this month
                  </p>
                </div>
                <div className="flex h-10 items-end gap-1" aria-hidden>
                  {FINANCE_BARS.map((height, index) => (
                    <span
                      key={index}
                      className="w-2.5 rounded-sm bg-[var(--ozer-slate-blue)]"
                      style={{ height: `${height}%` }}
                    />
                  ))}
                </div>
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
}: {
  animate: boolean;
  live: boolean;
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

      {/* Dashboard screen — lines land on its top edge */}
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
        <DashboardScreen animate={animate} live={live} />
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
}: {
  animate: boolean;
  live: boolean;
}) {
  return (
    <div>
      <div className="flex flex-wrap justify-center gap-1.5" aria-hidden>
        {FEATURE_NODES.map((node) => (
          <FeatureNodeChip key={node.id} node={node} />
        ))}
      </div>

      <MobileConnector live={live} />

      <DashboardScreen animate={animate} live={live} />
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

export function MarketingHeroConnectionMap() {
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
        <MobileConnectionMap animate={animate} live={live} />
      </div>
      <div className="hidden md:block">
        <DesktopConnectionMap animate={animate} live={live} />
      </div>
    </div>
  );
}
