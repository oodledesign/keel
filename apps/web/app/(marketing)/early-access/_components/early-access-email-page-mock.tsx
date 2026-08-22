'use client';

import { motion, useReducedMotion } from 'framer-motion';
import { Check, RefreshCw, Search, Sparkles } from 'lucide-react';

import { cn } from '@kit/ui/utils';

import {
  DemoCursor,
  DemoFrame,
  DemoHighlight,
  DemoPulse,
} from '~/(marketing)/early-access/_components/early-access-feature-demo-primitives';
import { marketingHeroEase } from '~/lib/marketing/marketing-ui';

const LOOP = 8;
const LOOP_EASE = marketingHeroEase;

const SUGGESTED_TASK = {
  title: 'Send Tradeways bullet points to Mel',
  detail: 'Draft and send the bullet points she requested for the page.',
  due: 'Fri 23 Aug',
  link: 'Tradeways Ltd / Mel B-C',
};

const panelClass =
  'rounded-xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)]';

const INBOX_THREADS = [
  {
    id: 'mel',
    sender: 'Mel B-C',
    subject: 'Re: Tradeways bullet point',
    time: '11:42',
    unread: true,
    badge: 'Untriaged',
    selected: true,
  },
  {
    id: 'outsourced',
    sender: 'The Outsourced Marketing Departm…',
    subject: 'Re: Tradeways bullet point',
    time: '10:57',
    unread: false,
    badge: 'Untriaged',
    selected: false,
  },
  {
    id: 'dan',
    sender: 'Dan Potter',
    subject: 'Re: Tradeways bullet point',
    time: '10:56',
    unread: false,
    badge: 'Untriaged',
    selected: false,
  },
] as const;

const FILTER_TABS = ['All', 'Action', 'Later'] as const;

function CategoryBadge({ label }: { label: string }) {
  return (
    <span className="inline-flex rounded-full border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] px-1.5 py-px text-[7px] font-semibold tracking-wide text-[var(--workspace-shell-text-muted)] uppercase">
      {label}
    </span>
  );
}

function InboxRow({
  thread,
  isSelected,
}: {
  thread: (typeof INBOX_THREADS)[number];
  isSelected: boolean;
}) {
  return (
    <div
      className={cn(
        'relative flex items-start gap-1.5 px-1.5 py-1.5',
        isSelected && 'bg-[var(--workspace-shell-sidebar-accent)]',
      )}
    >
      {isSelected ? (
        <DemoHighlight times={[0, 0.16, 0.22, 0.88, 1]} duration={LOOP} />
      ) : null}
      {isSelected ? <DemoPulse delay={0.4} /> : null}
      <span
        className={cn(
          'mt-1 size-1.5 shrink-0 rounded-full',
          thread.unread ? 'bg-[var(--ozer-accent)]' : 'bg-transparent',
        )}
        aria-hidden
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-1">
          <span
            className={cn(
              'truncate text-[9px]',
              thread.unread
                ? 'font-semibold text-[var(--workspace-shell-text)]'
                : 'font-medium text-[var(--workspace-shell-text)]',
            )}
          >
            {thread.sender}
          </span>
          <span className="shrink-0 text-[7px] text-[var(--workspace-shell-text-muted)] tabular-nums">
            {thread.time}
          </span>
        </div>
        <p className="mt-0.5 truncate text-[8px] text-[var(--workspace-shell-text-muted)]">
          {thread.subject}
        </p>
        <div className="mt-0.5">
          <CategoryBadge label={thread.badge} />
        </div>
      </div>
    </div>
  );
}

export function EarlyAccessEmailPageMock() {
  const reduced = useReducedMotion();

  return (
    <DemoFrame>
      <div className="flex h-full min-h-0 w-full flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <div>
            <p className="text-[11px] font-semibold text-[var(--workspace-shell-text)]">
              Emails
            </p>
            <p className="hidden text-[7px] text-[var(--workspace-shell-text-muted)] sm:block">
              Sync Gmail, draft replies, link threads to clients.
            </p>
          </div>
          <div className="flex items-center gap-1">
            <span className="rounded-md border border-[color:var(--workspace-shell-border)] px-1.5 py-0.5 text-[7px] text-[var(--workspace-shell-text-muted)]">
              Settings
            </span>
            <span className="inline-flex items-center gap-0.5 rounded-md bg-[var(--ozer-accent)] px-1.5 py-0.5 text-[7px] font-medium text-[var(--ozer-white)]">
              <RefreshCw className="size-2" aria-hidden />
              Sync
            </span>
          </div>
        </div>

        <div className="grid min-h-0 flex-1 grid-cols-[38%_minmax(0,1fr)] gap-2">
          <section className={cn(panelClass, 'flex min-h-0 flex-col overflow-hidden')}>
            <div className="shrink-0 border-b border-[color:var(--workspace-shell-border)] p-2">
              <p className="text-[9px] font-semibold text-[var(--workspace-shell-text)]">
                Inbox
              </p>
              <div className="mt-1.5 flex rounded-md border border-[color:var(--workspace-shell-border)] p-0.5">
                {FILTER_TABS.map((tab, index) => (
                  <span
                    key={tab}
                    className={cn(
                      'flex-1 rounded px-1 py-0.5 text-center text-[7px] font-medium',
                      index === 0
                        ? 'bg-[var(--workspace-shell-sidebar-accent)] text-[var(--workspace-shell-text)]'
                        : 'text-[var(--workspace-shell-text-muted)]',
                    )}
                  >
                    {tab}
                  </span>
                ))}
              </div>
              <div className="relative mt-1.5">
                <Search
                  className="pointer-events-none absolute top-1/2 left-1.5 size-2 -translate-y-1/2 text-[var(--workspace-shell-text-muted)]"
                  aria-hidden
                />
                <div className="h-5 rounded-md border border-[color:var(--workspace-shell-border)] bg-[var(--ozer-surface-canvas)] pl-5 text-[7px] leading-5 text-[var(--workspace-shell-text-muted)]">
                  Search subject, sender…
                </div>
              </div>
            </div>
            <div className="min-h-0 flex-1 divide-y divide-[color:var(--workspace-shell-border)] overflow-hidden">
              {INBOX_THREADS.map((thread) => (
                <InboxRow
                  key={thread.id}
                  thread={thread}
                  isSelected={thread.id === 'mel'}
                />
              ))}
            </div>
          </section>

          <section className={cn(panelClass, 'flex min-h-0 flex-col overflow-hidden')}>
            <div className="shrink-0 border-b border-[color:var(--workspace-shell-border)] px-2.5 py-2">
              <p className="text-[10px] font-semibold text-[var(--workspace-shell-text)]">
                Re: Tradeways bullet point
              </p>
              <div className="mt-1.5 rounded-lg border border-[color:var(--workspace-shell-border)] bg-[var(--ozer-surface-canvas)]/60 px-2 py-1.5">
                <p className="text-[7px] font-medium text-[var(--workspace-shell-text-muted)]">
                  Client / project
                </p>
                <p className="mt-0.5 text-[8px] font-medium text-[var(--workspace-shell-text)]">
                  Tradeways Ltd / Mel B-C
                </p>
              </div>
            </div>

            <div className="min-h-0 flex-1 space-y-1.5 overflow-hidden p-2">
              <div className="rounded-lg border border-[color:var(--workspace-shell-border)] bg-[var(--ozer-surface-canvas)]/50 p-1.5">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[8px] font-medium text-[var(--workspace-shell-text)]">
                    Mel B-C
                  </p>
                  <p className="text-[7px] text-[var(--workspace-shell-text-muted)]">
                    11:42
                  </p>
                </div>
                <p className="mt-0.5 text-[7px] leading-relaxed text-[var(--workspace-shell-text-muted)]">
                  Hi Dan, can you send over the bullet points for the Tradeways
                  page when you get a chance?
                </p>
              </div>

              <motion.div
                className="space-y-1 border-t border-[color:var(--workspace-shell-border)] pt-1.5"
                animate={
                  reduced
                    ? { opacity: 1, y: 0 }
                    : { opacity: [0, 0, 1, 1, 1, 1], y: [4, 4, 0, 0, 0, 0] }
                }
                transition={{
                  duration: LOOP,
                  repeat: reduced ? 0 : Infinity,
                  times: [0, 0.26, 0.32, 0.88, 0.95, 1],
                  ease: LOOP_EASE,
                }}
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[8px] font-semibold text-[var(--workspace-shell-text)]">
                    Suggested to-dos
                  </p>
                  <span className="relative inline-flex items-center gap-0.5 rounded-md border border-[color:var(--workspace-shell-border)] px-1.5 py-0.5 text-[7px] text-[var(--workspace-shell-text)]">
                    <DemoPulse className="rounded-md" delay={0.95} />
                    <Sparkles className="size-2 text-[var(--ozer-accent)]" aria-hidden />
                    Extract
                  </span>
                </div>

                <motion.p
                  className="rounded-md border border-dashed border-[color:var(--workspace-shell-border)] px-2 py-2 text-[7px] leading-relaxed text-[var(--workspace-shell-text-muted)]"
                  animate={
                    reduced ? { opacity: 0 } : { opacity: [1, 1, 0, 0, 1, 1] }
                  }
                  transition={{
                    duration: LOOP,
                    repeat: reduced ? 0 : Infinity,
                    times: [0, 0.32, 0.38, 0.82, 0.9, 1],
                  }}
                >
                  No open suggestions yet. Extract action items from this thread
                  with AI.
                </motion.p>

                <motion.div
                  className="relative rounded-md border border-[color:var(--workspace-shell-border)] bg-[var(--ozer-surface-canvas)]/50 p-1.5"
                  animate={
                    reduced
                      ? { opacity: 1, y: 0 }
                      : { opacity: [0, 0, 0, 1, 1, 0], y: [4, 4, 4, 0, 0, 4] }
                  }
                  transition={{
                    duration: LOOP,
                    repeat: reduced ? 0 : Infinity,
                    times: [0, 0.38, 0.42, 0.48, 0.82, 1],
                    ease: LOOP_EASE,
                  }}
                >
                  <DemoPulse className="rounded-md" delay={1.15} />
                  <p className="text-[7px] font-medium text-[var(--workspace-shell-text)]">
                    {SUGGESTED_TASK.title}
                  </p>
                  <p className="mt-0.5 text-[7px] text-[var(--workspace-shell-text-muted)]">
                    {SUGGESTED_TASK.detail}
                  </p>
                  <p className="mt-1 text-[6px] text-[var(--workspace-shell-text-muted)]">
                    Suggested due {SUGGESTED_TASK.due} ·{' '}
                    <span className="text-[var(--ozer-accent)]">
                      {SUGGESTED_TASK.link}
                    </span>
                  </p>
                  <div className="mt-1.5 flex items-center gap-1">
                    <motion.span
                      className="relative inline-flex items-center gap-0.5 rounded-md bg-[var(--ozer-accent)] px-1.5 py-0.5 text-[7px] font-medium text-[var(--ozer-white)]"
                      animate={
                        reduced
                          ? { opacity: 1 }
                          : { opacity: [1, 1, 1, 1, 0, 1] }
                      }
                      transition={{
                        duration: LOOP,
                        repeat: reduced ? 0 : Infinity,
                        times: [0, 0.58, 0.62, 0.66, 0.72, 1],
                      }}
                    >
                      <Check className="size-2" aria-hidden />
                      Accept
                    </motion.span>
                    <motion.span
                      className="inline-flex rounded-full bg-emerald-100 px-1.5 py-px text-[6px] font-semibold tracking-wide text-emerald-900 uppercase"
                      animate={
                        reduced
                          ? { opacity: 1 }
                          : { opacity: [0, 0, 0, 0, 1, 1, 0] }
                      }
                      transition={{
                        duration: LOOP,
                        repeat: reduced ? 0 : Infinity,
                        times: [0, 0.62, 0.66, 0.7, 0.74, 0.88, 1],
                      }}
                    >
                      Accepted
                    </motion.span>
                  </div>
                </motion.div>
              </motion.div>

              <motion.div
                className="space-y-1 border-t border-[color:var(--workspace-shell-border)] pt-1.5"
                animate={
                  reduced
                    ? { opacity: 1, y: 0 }
                    : { opacity: [0, 0, 0, 0, 1, 1, 0], y: [6, 6, 6, 6, 0, 0, 6] }
                }
                transition={{
                  duration: LOOP,
                  repeat: reduced ? 0 : Infinity,
                  times: [0, 0.48, 0.58, 0.68, 0.74, 0.92, 1],
                  ease: LOOP_EASE,
                }}
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[8px] font-semibold text-[var(--workspace-shell-text)]">
                    Draft reply
                  </p>
                  <span className="relative inline-flex items-center gap-0.5 rounded-md border border-[color:var(--workspace-shell-border)] px-1.5 py-0.5 text-[7px] text-[var(--workspace-shell-text)]">
                    <DemoPulse className="rounded-md" delay={1.75} />
                    <Sparkles className="size-2 text-[var(--ozer-accent)]" aria-hidden />
                    Generate
                  </span>
                </div>
                <div className="relative min-h-[3.25rem] rounded-md border border-[color:var(--workspace-shell-border)] bg-[var(--ozer-surface-canvas)] p-1.5">
                  <motion.p
                    className="text-[7px] leading-relaxed text-[var(--workspace-shell-text)]"
                    animate={
                      reduced
                        ? { opacity: 1 }
                        : { opacity: [0, 0, 0, 0, 0, 1, 1, 0] }
                    }
                    transition={{
                      duration: LOOP,
                      repeat: reduced ? 0 : Infinity,
                      times: [0, 0.68, 0.74, 0.78, 0.82, 0.86, 0.94, 1],
                    }}
                  >
                    Hi Mel — here are the bullet points for Tradeways. Let me
                    know if you want any tweaks before we publish.
                  </motion.p>
                  <motion.div
                    className="absolute inset-1.5 space-y-1"
                    animate={
                      reduced
                        ? { opacity: 0 }
                        : { opacity: [1, 1, 1, 1, 1, 0, 0, 1] }
                    }
                    transition={{
                      duration: LOOP,
                      repeat: reduced ? 0 : Infinity,
                      times: [0, 0.68, 0.74, 0.78, 0.82, 0.86, 0.94, 1],
                    }}
                  >
                    <div className="h-1 w-full rounded bg-[color:var(--workspace-shell-border)]/80" />
                    <div className="h-1 w-[88%] rounded bg-[color:var(--workspace-shell-border)]/60" />
                    <div className="h-1 w-[72%] rounded bg-[color:var(--workspace-shell-border)]/40" />
                  </motion.div>
                </div>
                <motion.span
                  className="inline-flex rounded-md bg-[var(--ozer-accent)] px-2 py-1 text-[7px] font-medium text-[var(--ozer-white)]"
                  animate={
                    reduced
                      ? { opacity: 1 }
                      : { opacity: [0, 0, 0, 0, 0, 0, 1, 1, 0] }
                  }
                  transition={{
                    duration: LOOP,
                    repeat: reduced ? 0 : Infinity,
                    times: [0, 0.74, 0.78, 0.82, 0.86, 0.9, 0.94, 0.98, 1],
                  }}
                >
                  Send to Gmail
                </motion.span>
              </motion.div>
            </div>
          </section>
        </div>

        <DemoCursor
          x={['22%', '22%', '72%', '72%', '76%', '68%', '68%']}
          y={['52%', '52%', '46%', '46%', '56%', '82%', '82%']}
          times={[0, 0.18, 0.36, 0.4, 0.64, 0.8, 0.9]}
          clickAt={[0.18, 0.4, 0.64, 0.8, 0.9]}
          duration={LOOP}
        />
      </div>
    </DemoFrame>
  );
}
