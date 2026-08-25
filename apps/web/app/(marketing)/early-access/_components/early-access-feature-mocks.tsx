'use client';

import { motion, useReducedMotion } from 'framer-motion';

import { cn } from '@kit/ui/utils';

import { EarlyAccessEmailPageMock } from '~/(marketing)/early-access/_components/early-access-email-page-mock';
import {
  DemoCursor,
  DemoFrame,
  DemoHighlight,
  DemoPulse,
  FEATURE_DEMO_SHELL_CLASS,
} from '~/(marketing)/early-access/_components/early-access-feature-demo-primitives';
import {
  EARLY_ACCESS_ACCENT_CLASS,
  EARLY_ACCESS_ACCENT_SOFT_CLASS,
  EARLY_ACCESS_ACCENT_TEXT_CLASS,
  type EarlyAccessAccent,
} from '~/lib/marketing/early-access-content';
import { marketingHeroEase } from '~/lib/marketing/marketing-ui';

const LOOP = 5.5;
const LOOP_EASE = marketingHeroEase;

function KanbanMock() {
  const reduced = useReducedMotion();

  return (
    <DemoFrame>
      <div className="relative flex h-full flex-col justify-center">
        <div className="relative grid grid-cols-3 gap-2.5">
          {[
            { label: 'Enquiry', items: ['Logo refresh'] },
            { label: 'In progress', items: ['Brand guide'] },
            { label: 'Invoiced', items: ['Website build'] },
          ].map((col, colIndex) => (
            <div key={col.label} className="relative">
              <p className="mb-2 text-[10px] font-medium tracking-[0.04em] text-[var(--workspace-shell-text-muted)] uppercase">
                {col.label}
              </p>
              {col.items.map((item) => (
                <div
                  key={item}
                  className="mb-2 rounded-[0.625rem] border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-canvas)] px-2.5 py-2.5 text-xs text-[var(--workspace-shell-text-muted)]"
                >
                  {item}
                </div>
              ))}
              {colIndex === 1 ? (
                <motion.div
                  className="mb-2 rounded-[0.625rem] border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-canvas)] px-2.5 py-2.5 text-xs text-[var(--workspace-shell-text-muted)]"
                  animate={
                    reduced ? { opacity: 1 } : { opacity: [0, 0, 1, 1, 0] }
                  }
                  transition={{
                    duration: LOOP,
                    repeat: reduced ? 0 : Infinity,
                    times: [0, 0.5, 0.58, 0.85, 1],
                  }}
                >
                  Landing page
                </motion.div>
              ) : null}
            </div>
          ))}
          <motion.div
            className="absolute top-[1.65rem] left-0 w-[calc((100%-1.25rem)/3)] rounded-[0.625rem] border border-[color:var(--ozer-accent)]/35 bg-[var(--workspace-shell-canvas)] px-2.5 py-2.5 text-xs font-medium text-[var(--workspace-shell-text)] shadow-[0_8px_24px_var(--ozer-plum-alpha-12)]"
            animate={
              reduced
                ? { x: 0, y: 0, opacity: 1 }
                : {
                    x: [
                      0,
                      0,
                      'calc(100% + 0.625rem)',
                      'calc(100% + 0.625rem)',
                      0,
                    ],
                    y: [0, -4, -4, 0, 0],
                    opacity: [1, 1, 1, 1, 0],
                  }
            }
            transition={{
              duration: LOOP,
              repeat: reduced ? 0 : Infinity,
              ease: LOOP_EASE,
              times: [0, 0.15, 0.42, 0.55, 0.9],
            }}
          >
            Landing page
            <DemoPulse className="rounded-[0.625rem]" delay={0.8} />
          </motion.div>
        </div>
        <DemoCursor
          x={['18%', '18%', '58%', '58%', '18%']}
          y={['42%', '38%', '38%', '62%', '42%']}
          times={[0, 0.15, 0.42, 0.55, 0.9]}
          clickAt={[0.15, 0.42]}
          duration={LOOP}
        />
      </div>
    </DemoFrame>
  );
}

function InvoiceMock() {
  const reduced = useReducedMotion();
  const rows = [
    { name: 'Website redesign', amount: '£1,200', status: 'Paid' as const },
    { name: 'Brand assets', amount: '£450', status: 'Sent' as const },
    { name: 'Monthly retainer', amount: '£300', status: 'Due' as const },
  ];

  const statusClass = {
    Paid: 'bg-[var(--ozer-sage-100)] text-[var(--ozer-plum-700)]',
    Sent: 'bg-[var(--ozer-sky-100)] text-[var(--ozer-cool-blue)]',
    Due: 'bg-[var(--ozer-coral-50)] text-[var(--ozer-coral-600)]',
  };

  return (
    <DemoFrame>
      <div className="relative flex h-full flex-col justify-center gap-2">
        {rows.map((row, index) => (
          <div
            key={row.name}
            className={cn(
              'relative flex items-center gap-2.5 border-b border-[color:var(--workspace-shell-border)] py-2.5 text-sm last:border-b-0',
              index === 1 && 'rounded-lg px-1',
            )}
          >
            {index === 1 ? (
              <DemoPulse className="rounded-lg" delay={1.1} />
            ) : null}
            <span className="flex-1 text-[var(--workspace-shell-text)]">
              {row.name}
            </span>
            <span className="font-mono text-xs text-[var(--workspace-shell-text-muted)]">
              {row.amount}
            </span>
            {index === 1 ? (
              <motion.span
                className={cn(
                  'rounded-full px-2.5 py-0.5 text-[10px] font-bold tracking-[0.03em] uppercase',
                  statusClass.Paid,
                )}
                animate={
                  reduced
                    ? { opacity: 1 }
                    : {
                        opacity: [1, 1, 0, 0, 1],
                      }
                }
                transition={{
                  duration: LOOP,
                  repeat: reduced ? 0 : Infinity,
                  times: [0, 0.35, 0.4, 0.55, 0.65],
                }}
              >
                Paid
              </motion.span>
            ) : (
              <span
                className={cn(
                  'rounded-full px-2.5 py-0.5 text-[10px] font-bold tracking-[0.03em] uppercase',
                  statusClass[row.status],
                )}
              >
                {row.status}
              </span>
            )}
            {index === 1 ? (
              <motion.span
                className={cn(
                  'absolute right-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold tracking-[0.03em] uppercase',
                  statusClass.Sent,
                )}
                animate={
                  reduced ? { opacity: 0 } : { opacity: [1, 1, 0, 0, 1] }
                }
                transition={{
                  duration: LOOP,
                  repeat: reduced ? 0 : Infinity,
                  times: [0, 0.35, 0.4, 0.55, 0.65],
                }}
              >
                Sent
              </motion.span>
            ) : null}
          </div>
        ))}
        <motion.div
          className="flex justify-between pt-1 text-sm font-bold text-[var(--workspace-shell-text)]"
          animate={reduced ? {} : { opacity: [1, 1, 0.85, 1] }}
          transition={{
            duration: LOOP,
            repeat: reduced ? 0 : Infinity,
            times: [0, 0.38, 0.55, 0.75],
          }}
        >
          <span>Outstanding</span>
          <span>£750</span>
        </motion.div>
        <DemoCursor
          x={['72%', '72%', '72%']}
          y={['38%', '38%', '38%']}
          times={[0, 0.38, 0.7]}
          clickAt={[0.38]}
          duration={LOOP}
        />
      </div>
    </DemoFrame>
  );
}

function PortalMock() {
  const reduced = useReducedMotion();
  const files = [
    'Homepage_v3.fig',
    'Brand_guidelines.pdf',
    'Meeting_notes_Aug.md',
  ];

  return (
    <DemoFrame>
      <div className="relative flex h-full flex-col justify-center gap-2.5">
        {files.map((file, index) => (
          <div
            key={file}
            className="relative flex items-center gap-2.5 rounded-lg px-2 py-2 text-sm"
          >
            {index === 0 ? (
              <DemoHighlight times={[0, 0.35, 0.4, 0.7, 1]} duration={LOOP} />
            ) : null}
            {index === 0 ? <DemoPulse delay={0.9} /> : null}
            <span
              className="size-2 shrink-0 rounded-[3px] bg-[var(--ozer-sage-500)]"
              aria-hidden
            />
            <span className="flex-1 text-[var(--workspace-shell-text)]">
              {file}
            </span>
            {index === 0 ? (
              <motion.span
                className="text-xs font-medium text-[var(--ozer-accent)]"
                animate={
                  reduced ? { opacity: 1 } : { opacity: [0, 0, 1, 1, 0] }
                }
                transition={{
                  duration: LOOP,
                  repeat: reduced ? 0 : Infinity,
                  times: [0, 0.42, 0.5, 0.8, 1],
                }}
              >
                Opened
              </motion.span>
            ) : (
              <span className="text-xs text-[var(--workspace-shell-text-muted)]">
                Shared
              </span>
            )}
          </div>
        ))}
        <DemoCursor
          x={['24%', '24%', '24%']}
          y={['28%', '28%', '28%']}
          times={[0, 0.35, 0.75]}
          clickAt={[0.35]}
          duration={LOOP}
        />
      </div>
    </DemoFrame>
  );
}

function NotesMock() {
  const reduced = useReducedMotion();

  return (
    <DemoFrame>
      <div className="relative flex h-full flex-col justify-center">
        <p className="mb-3 text-sm font-bold text-[var(--workspace-shell-text)]">
          Call with Aimee — 14 Aug
        </p>
        <motion.div
          className="mb-2 h-2 w-[82%] rounded bg-[color:var(--workspace-shell-border)]"
          animate={
            reduced
              ? { opacity: 1, scaleX: 1 }
              : {
                  opacity: [0, 1, 1],
                  scaleX: [0, 1, 1],
                  transformOrigin: 'left',
                }
          }
          transition={{
            duration: LOOP,
            repeat: reduced ? 0 : Infinity,
            times: [0, 0.2, 1],
          }}
        />
        <motion.div
          className="mb-3 h-2 w-[58%] rounded bg-[color:var(--workspace-shell-border)]"
          animate={
            reduced
              ? { opacity: 1, scaleX: 1 }
              : {
                  opacity: [0, 0, 1, 1],
                  scaleX: [0, 0, 1, 1],
                  transformOrigin: 'left',
                }
          }
          transition={{
            duration: LOOP,
            repeat: reduced ? 0 : Infinity,
            times: [0, 0.25, 0.45, 1],
          }}
        />
        <div className="flex gap-2">
          {['next-step', 'pricing'].map((tag, index) => (
            <motion.span
              key={tag}
              className="rounded-full bg-[var(--ozer-lime-100)] px-2.5 py-1 text-[11px] font-bold text-[var(--ozer-plum-700)]"
              animate={
                reduced
                  ? { opacity: 1, scale: 1 }
                  : {
                      opacity: [0, 0, 1, 1],
                      scale: [0.92, 0.92, 1, 1],
                    }
              }
              transition={{
                duration: LOOP,
                repeat: reduced ? 0 : Infinity,
                times: [0, 0.45 + index * 0.08, 0.55 + index * 0.08, 1],
              }}
            >
              {tag}
            </motion.span>
          ))}
        </div>
        <DemoCursor
          x={['18%', '52%', '52%']}
          y={['58%', '58%', '72%']}
          times={[0, 0.45, 0.75]}
          clickAt={[0.45, 0.52]}
          duration={LOOP}
        />
      </div>
    </DemoFrame>
  );
}

function EmailMock() {
  return <EarlyAccessEmailPageMock />;
}

function PlannerMock({ accent }: { accent: EarlyAccessAccent }) {
  const reduced = useReducedMotion();
  const slots = [
    { time: '9:00', label: 'Client call — Aimee' },
    { time: '11:00', label: 'Deep work — website build' },
    { time: '14:00', label: 'Task: send invoice' },
    { time: '16:00', label: 'Follow-up emails' },
  ];

  return (
    <DemoFrame>
      <div className="relative flex h-full flex-col justify-center gap-2.5">
        {slots.map((slot, index) => (
          <div
            key={slot.time}
            className="relative flex items-center gap-2.5 rounded-lg px-1 py-1 text-xs"
          >
            {index === 1 ? <DemoHighlight delay={0} duration={LOOP} /> : null}
            {index === 1 ? <DemoPulse delay={1} /> : null}
            <span className="w-9 shrink-0 font-mono text-[var(--workspace-shell-text-muted)]">
              {slot.time}
            </span>
            <motion.span
              className={cn(
                'h-5 w-0.5 shrink-0 rounded-sm',
                EARLY_ACCESS_ACCENT_CLASS[accent],
              )}
              animate={
                reduced
                  ? { opacity: index === 1 ? 1 : 0.35 }
                  : {
                      opacity:
                        index === 1
                          ? [0.35, 0.35, 1, 1, 0.35]
                          : [0.35, 0.35, 0.35, 0.35, 0.35],
                    }
              }
              transition={{
                duration: LOOP,
                repeat: reduced ? 0 : Infinity,
                times: [0, 0.3, 0.4, 0.75, 1],
              }}
            />
            <motion.span
              className={cn(
                index === 1
                  ? 'font-semibold text-[var(--workspace-shell-text)]'
                  : 'text-[var(--workspace-shell-text-muted)]',
              )}
              animate={
                reduced
                  ? {}
                  : index === 1
                    ? { opacity: [0.55, 0.55, 1, 1, 0.55] }
                    : {}
              }
              transition={{
                duration: LOOP,
                repeat: reduced ? 0 : Infinity,
                times: [0, 0.3, 0.4, 0.75, 1],
              }}
            >
              {slot.label}
            </motion.span>
          </div>
        ))}
        <DemoCursor
          x={['22%', '22%', '22%']}
          y={['42%', '42%', '42%']}
          times={[0, 0.35, 0.8]}
          clickAt={[0.35]}
          duration={LOOP}
        />
      </div>
    </DemoFrame>
  );
}

function RequestsMock({ accent }: { accent: EarlyAccessAccent }) {
  const reduced = useReducedMotion();
  const services = [
    { name: 'Landing page copy edit', cost: '2' },
    { name: 'New page build', cost: '6' },
    { name: 'Social media graphic', cost: '1' },
  ];

  return (
    <DemoFrame>
      <div className="relative flex h-full flex-col justify-center gap-2">
        {services.map((service, index) => (
          <motion.div
            key={service.name}
            className={cn(
              'relative flex items-center justify-between gap-3 border-b border-[color:var(--workspace-shell-border)] py-2.5 text-sm last:border-b-0',
              index === 0 && 'rounded-lg px-1',
            )}
            animate={
              reduced ? {} : index === 0 ? { opacity: [1, 1, 0.55, 1] } : {}
            }
            transition={{
              duration: LOOP,
              repeat: reduced ? 0 : Infinity,
              times: [0, 0.38, 0.55, 0.75],
            }}
          >
            {index === 0 ? <DemoPulse delay={0.95} /> : null}
            <span className="text-[var(--workspace-shell-text)]">
              {service.name}
            </span>
            <span
              className={cn(
                'shrink-0 rounded-full px-2.5 py-0.5 font-mono text-[11px]',
                EARLY_ACCESS_ACCENT_SOFT_CLASS[accent],
              )}
            >
              {service.cost} credits
            </span>
          </motion.div>
        ))}
        <div className="relative flex justify-between pt-1 text-sm font-bold text-[var(--workspace-shell-text)]">
          <span>Credits remaining</span>
          <motion.span
            className={EARLY_ACCESS_ACCENT_TEXT_CLASS[accent]}
            animate={reduced ? {} : { opacity: [1, 1, 0, 1] }}
            transition={{
              duration: LOOP,
              repeat: reduced ? 0 : Infinity,
              times: [0, 0.38, 0.52, 0.65],
            }}
          >
            14
          </motion.span>
          <motion.span
            className={cn(
              'absolute right-0',
              EARLY_ACCESS_ACCENT_TEXT_CLASS[accent],
            )}
            animate={reduced ? { opacity: 0 } : { opacity: [0, 0, 1, 1, 0] }}
            transition={{
              duration: LOOP,
              repeat: reduced ? 0 : Infinity,
              times: [0, 0.5, 0.58, 0.8, 1],
            }}
          >
            12
          </motion.span>
        </div>
        <DemoCursor
          x={['38%', '38%', '38%']}
          y={['30%', '30%', '30%']}
          times={[0, 0.38, 0.8]}
          clickAt={[0.38]}
          duration={LOOP}
        />
      </div>
    </DemoFrame>
  );
}

export function EarlyAccessFeatureMock({
  type,
  accent,
  className,
}: {
  type:
    | 'kanban'
    | 'invoice'
    | 'portal'
    | 'notes'
    | 'email'
    | 'requests'
    | 'planner';
  accent: EarlyAccessAccent;
  className?: string;
}) {
  const content = (() => {
    switch (type) {
      case 'kanban':
        return <KanbanMock />;
      case 'invoice':
        return <InvoiceMock />;
      case 'portal':
        return <PortalMock />;
      case 'notes':
        return <NotesMock />;
      case 'email':
        return <EmailMock />;
      case 'requests':
        return <RequestsMock accent={accent} />;
      case 'planner':
        return <PlannerMock accent={accent} />;
      default:
        return null;
    }
  })();

  return (
    <div className={cn(FEATURE_DEMO_SHELL_CLASS, 'min-h-0', className)}>
      {content}
    </div>
  );
}
