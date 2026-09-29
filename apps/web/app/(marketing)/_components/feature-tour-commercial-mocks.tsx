'use client';

import { motion, useReducedMotion } from 'framer-motion';
import { Check } from 'lucide-react';

import { cn } from '@kit/ui/utils';

import {
  DemoFrame,
  DemoHighlight,
  DemoPulse,
} from '~/(marketing)/_components/feature-tour-demo-primitives';
import {
  EARLY_ACCESS_ACCENT_CLASS,
  EARLY_ACCESS_ACCENT_SOFT_CLASS,
  EARLY_ACCESS_ACCENT_TEXT_CLASS,
  type EarlyAccessAccent,
} from '~/lib/marketing/early-access-content';

const LOOP = 5.5;

const LABEL_CLASS =
  'text-[10px] font-medium tracking-[0.04em] text-[var(--workspace-shell-text-muted)] uppercase';

const ROW_CLASS =
  'relative flex items-center gap-2.5 rounded-lg border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-canvas)] px-2.5 py-2 text-xs';

const LIVE_BADGE_CLASS =
  'rounded-full bg-[var(--ozer-sage-100)] px-2 py-0.5 text-[10px] font-bold tracking-[0.03em] text-[var(--ozer-plum-700)] uppercase';

const QUEUED_BADGE_CLASS =
  'rounded-full bg-[var(--workspace-shell-sidebar-accent)] px-2 py-0.5 text-[10px] font-bold tracking-[0.03em] text-[var(--workspace-shell-text-muted)] uppercase';

function useLoop() {
  const reduced = useReducedMotion();

  return {
    reduced,
    transition: (times: number[]) => ({
      duration: LOOP,
      repeat: reduced ? 0 : Infinity,
      times,
    }),
  };
}

/** Badge that swaps from `from` to `to` at `at` (0–1) in the loop. */
function SwapBadge({
  at,
  from,
  to,
}: {
  at: number;
  from: { label: string; className: string };
  to: { label: string; className: string };
}) {
  const { reduced, transition } = useLoop();
  const times = [0, at, Math.min(at + 0.04, 0.99), 0.92, 1];

  return (
    <span className="relative inline-flex shrink-0 justify-end">
      <motion.span
        className={from.className}
        animate={reduced ? { opacity: 0 } : { opacity: [1, 1, 0, 0, 1] }}
        transition={transition(times)}
      >
        {from.label}
      </motion.span>
      <motion.span
        className={cn('absolute right-0', to.className)}
        animate={reduced ? { opacity: 1 } : { opacity: [0, 0, 1, 1, 0] }}
        transition={transition(times)}
      >
        {to.label}
      </motion.span>
    </span>
  );
}

export function PublishPortalsMock() {
  const portals = ['Rightmove Commercial', 'EACH', 'Property Hive'];

  return (
    <DemoFrame>
      <div className="relative flex h-full flex-col justify-center gap-3">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-[var(--workspace-shell-text)]">
              Unit 4, Riverside Park
            </p>
            <p className="text-[11px] text-[var(--workspace-shell-text-muted)]">
              2,450 sq ft · Industrial · To let
            </p>
          </div>
          <span className="relative shrink-0 rounded-full bg-[var(--ozer-accent)] px-3 py-1 text-[11px] font-semibold text-[var(--ozer-plum-950)]">
            Publish
            <DemoPulse className="rounded-full" delay={0.4} />
          </span>
        </div>
        <div className="space-y-1.5">
          {portals.map((portal, index) => (
            <div key={portal} className={ROW_CLASS}>
              <span className="flex-1 text-[var(--workspace-shell-text)]">
                {portal}
              </span>
              <SwapBadge
                at={0.3 + index * 0.1}
                from={{ label: 'Queued', className: QUEUED_BADGE_CLASS }}
                to={{ label: 'Live', className: LIVE_BADGE_CLASS }}
              />
            </div>
          ))}
        </div>
      </div>
    </DemoFrame>
  );
}

export function RequirementsMatchMock({
  accent,
}: {
  accent: EarlyAccessAccent;
}) {
  const { reduced, transition } = useLoop();
  const matches = [
    { name: '12 High Street', fit: 92 },
    { name: 'The Arcade, Unit 3', fit: 81 },
    { name: 'Market Square', fit: 64 },
  ];

  return (
    <DemoFrame>
      <div className="relative flex h-full flex-col justify-center gap-3">
        <div className="rounded-lg border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-canvas)] px-3 py-2">
          <p className={LABEL_CLASS}>Requirement</p>
          <p className="mt-0.5 text-xs font-semibold text-[var(--workspace-shell-text)]">
            Retail · 1,800–2,500 sq ft · Town centre
          </p>
        </div>
        <div className="space-y-2">
          {matches.map((match, index) => (
            <div key={match.name} className="relative rounded-lg px-1 py-0.5">
              {index === 0 ? (
                <DemoHighlight
                  times={[0, 0.5, 0.58, 0.85, 1]}
                  duration={LOOP}
                />
              ) : null}
              <div className="relative flex items-center justify-between gap-2 text-xs">
                <span className="text-[var(--workspace-shell-text)]">
                  {match.name}
                </span>
                <span
                  className={cn(
                    'font-mono text-[11px] font-semibold',
                    EARLY_ACCESS_ACCENT_TEXT_CLASS[accent],
                  )}
                >
                  {match.fit}%
                </span>
              </div>
              <div className="relative mt-1 h-1.5 overflow-hidden rounded-full bg-[var(--workspace-shell-sidebar-accent)]">
                <motion.div
                  className={cn(
                    'h-full origin-left rounded-full',
                    EARLY_ACCESS_ACCENT_CLASS[accent],
                  )}
                  style={{ width: `${match.fit}%` }}
                  animate={
                    reduced ? { scaleX: 1 } : { scaleX: [0, 0, 1, 1, 0] }
                  }
                  transition={transition([
                    0,
                    0.08 + index * 0.08,
                    0.3 + index * 0.08,
                    0.9,
                    1,
                  ])}
                />
              </div>
            </div>
          ))}
        </div>
        <motion.span
          className={cn(
            'relative w-fit rounded-full px-2.5 py-1 text-[10px] font-bold',
            EARLY_ACCESS_ACCENT_SOFT_CLASS[accent],
          )}
          animate={reduced ? { opacity: 1 } : { opacity: [0, 0, 1, 1, 0] }}
          transition={transition([0, 0.55, 0.62, 0.88, 1])}
        >
          Added to interest schedule
        </motion.span>
      </div>
    </DemoFrame>
  );
}

export function CirculationMock() {
  const { reduced, transition } = useLoop();
  const applicants = [
    { name: 'Northgate Logistics', brief: '2–3k sq ft industrial' },
    { name: 'Fenwick Trade Supplies', brief: 'Trade counter, M6 access' },
    { name: 'Harbour Storage Co.', brief: 'Warehouse, to let' },
  ];

  return (
    <DemoFrame>
      <div className="relative flex h-full flex-col justify-center gap-3">
        <div className="flex items-center gap-2 text-xs">
          <span className={LIVE_BADGE_CLASS}>Live</span>
          <span className="font-semibold text-[var(--workspace-shell-text)]">
            Unit 4, Riverside Park
          </span>
        </div>
        <p className={LABEL_CLASS}>Matched applicants</p>
        <div className="space-y-1.5">
          {applicants.map((applicant, index) => (
            <div key={applicant.name} className={ROW_CLASS}>
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-[var(--workspace-shell-text)]">
                  {applicant.name}
                </p>
                <p className="truncate text-[10px] text-[var(--workspace-shell-text-muted)]">
                  {applicant.brief}
                </p>
              </div>
              <motion.span
                className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[var(--ozer-sage-100)] px-2 py-0.5 text-[10px] font-semibold text-[var(--ozer-plum-700)]"
                animate={
                  reduced
                    ? { opacity: 1, scale: 1 }
                    : {
                        opacity: [0, 0, 1, 1, 0],
                        scale: [0.9, 0.9, 1, 1, 0.9],
                      }
                }
                transition={transition([
                  0,
                  0.2 + index * 0.14,
                  0.26 + index * 0.14,
                  0.9,
                  1,
                ])}
              >
                <Check className="size-3" aria-hidden />
                Sent
              </motion.span>
            </div>
          ))}
        </div>
        <p className="text-[11px] text-[var(--workspace-shell-text-muted)]">
          3 matched · 0 mail-merged by hand
        </p>
      </div>
    </DemoFrame>
  );
}

export function DisposalsPipelineMock() {
  const { reduced, transition } = useLoop();
  const columns = [
    { label: 'Current', items: ['Unit 7, Bridge Rd'] },
    { label: 'Under offer', items: ['Mill House'] },
    { label: 'Completed', items: ['2 Dock Lane'] },
  ];
  const times = [0, 0.15, 0.42, 0.55, 0.9];

  return (
    <DemoFrame>
      <div className="relative flex h-full flex-col justify-center gap-3">
        <div className="relative grid grid-cols-3 gap-2.5">
          {columns.map((column, columnIndex) => (
            <div key={column.label}>
              <p className={cn(LABEL_CLASS, 'mb-2')}>{column.label}</p>
              {column.items.map((item) => (
                <div
                  key={item}
                  className="mb-2 rounded-[0.625rem] border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-canvas)] px-2.5 py-2.5 text-xs text-[var(--workspace-shell-text-muted)]"
                >
                  {item}
                </div>
              ))}
              {columnIndex === 1 ? (
                <motion.div
                  className="relative z-10 rounded-[0.625rem] border border-[color:var(--ozer-accent)]/35 bg-[var(--workspace-shell-canvas)] px-2.5 py-2.5 text-xs font-medium text-[var(--workspace-shell-text)] shadow-[0_8px_24px_var(--ozer-plum-alpha-12)]"
                  animate={
                    reduced
                      ? { x: 0, opacity: 1 }
                      : {
                          x: [
                            0,
                            0,
                            'calc(100% + 0.625rem)',
                            'calc(100% + 0.625rem)',
                            0,
                          ],
                          opacity: [1, 1, 1, 1, 0],
                        }
                  }
                  transition={{ ...transition(times), ease: 'easeInOut' }}
                >
                  Quay Offices
                </motion.div>
              ) : null}
            </div>
          ))}
        </div>
        <div className="flex items-center justify-between border-t border-[color:var(--workspace-shell-border)] pt-2 text-sm font-bold text-[var(--workspace-shell-text)]">
          <span>Fees completed this quarter</span>
          <span className="relative inline-flex justify-end">
            <motion.span
              animate={reduced ? { opacity: 0 } : { opacity: [1, 1, 0, 0, 1] }}
              transition={transition([0, 0.42, 0.46, 0.9, 1])}
            >
              £48,500
            </motion.span>
            <motion.span
              className="absolute right-0 text-[var(--ozer-accent)]"
              animate={reduced ? { opacity: 1 } : { opacity: [0, 0, 1, 1, 0] }}
              transition={transition([0, 0.42, 0.46, 0.9, 1])}
            >
              £62,000
            </motion.span>
          </span>
        </div>
      </div>
    </DemoFrame>
  );
}

export function AskAiMock({ accent }: { accent: EarlyAccessAccent }) {
  const { reduced, transition } = useLoop();
  const lines = ['w-[92%]', 'w-[84%]', 'w-[88%]', 'w-[56%]'];

  return (
    <DemoFrame>
      <div className="relative flex h-full flex-col justify-center gap-3">
        <div className="rounded-lg border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-canvas)] px-3 py-2 text-xs text-[var(--workspace-shell-text)]">
          <motion.span
            className="inline-block overflow-hidden align-bottom whitespace-nowrap"
            animate={
              reduced
                ? { maxWidth: '100%' }
                : { maxWidth: ['0%', '100%', '100%'] }
            }
            transition={transition([0, 0.28, 1])}
          >
            Write a LinkedIn post about last month’s lettings
          </motion.span>
        </div>
        <div className="space-y-2 rounded-lg px-1">
          {lines.map((width, index) => (
            <motion.div
              key={width}
              className={cn(
                'h-2 rounded bg-[color:var(--workspace-shell-border)]',
                width,
              )}
              animate={
                reduced
                  ? { opacity: 1, scaleX: 1 }
                  : {
                      opacity: [0, 0, 1, 1, 0],
                      scaleX: [0, 0, 1, 1, 1],
                    }
              }
              style={{ transformOrigin: 'left' }}
              transition={transition([
                0,
                0.34 + index * 0.07,
                0.44 + index * 0.07,
                0.92,
                1,
              ])}
            />
          ))}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {['#CommercialProperty', '#Lettings'].map((tag, index) => (
            <motion.span
              key={tag}
              className={cn(
                'rounded-full px-2 py-0.5 text-[10px] font-bold',
                EARLY_ACCESS_ACCENT_SOFT_CLASS[accent],
              )}
              animate={reduced ? { opacity: 1 } : { opacity: [0, 0, 1, 1, 0] }}
              transition={transition([
                0,
                0.66 + index * 0.05,
                0.72 + index * 0.05,
                0.92,
                1,
              ])}
            >
              {tag}
            </motion.span>
          ))}
        </div>
        <p className="text-[10px] text-[var(--workspace-shell-text-muted)]">
          Based on 3 launches, 2 lettings and 1 sale last month
        </p>
      </div>
    </DemoFrame>
  );
}

export function BrochureMock({ accent }: { accent: EarlyAccessAccent }) {
  const facts = ['2,450 sq ft', 'EPC B', '8m eaves'];

  return (
    <DemoFrame>
      <div className="relative flex h-full items-center justify-center">
        <div className="w-full max-w-[17rem] overflow-hidden rounded-xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-canvas)]">
          <div
            className={cn(
              'relative h-16 opacity-80 sm:h-20',
              EARLY_ACCESS_ACCENT_CLASS[accent],
            )}
            aria-hidden
          >
            <span className="absolute top-2 left-2 rounded bg-[var(--ozer-cream-50)] px-1.5 py-0.5 text-[9px] font-bold text-[var(--ozer-plum-900)]">
              Your agency
            </span>
          </div>
          <div className="space-y-2 p-3">
            <p className="text-xs font-semibold text-[var(--workspace-shell-text)]">
              Unit 4, Riverside Park
            </p>
            <div className="flex flex-wrap gap-1">
              {facts.map((fact) => (
                <span
                  key={fact}
                  className="rounded-full bg-[var(--workspace-shell-sidebar-accent)] px-2 py-0.5 text-[10px] text-[var(--workspace-shell-text-muted)]"
                >
                  {fact}
                </span>
              ))}
            </div>
            <span className="relative inline-flex w-full justify-center rounded-lg bg-[var(--ozer-accent)] py-1.5 text-[11px] font-semibold text-[var(--ozer-plum-950)]">
              Enquire
              <DemoPulse className="rounded-lg" delay={1.2} />
            </span>
          </div>
        </div>
      </div>
    </DemoFrame>
  );
}
