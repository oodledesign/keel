import type { LucideIcon } from 'lucide-react';

import { cn } from '@kit/ui/utils';

const panelTitleIconClass = 'h-4 w-4 shrink-0 text-[var(--ozer-accent)]';

export function DashboardPanelTitle({
  icon: Icon,
  children,
  className,
}: {
  icon: LucideIcon;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <h2
      className={cn(
        'flex items-center gap-2 text-sm font-semibold text-[var(--workspace-shell-text)]',
        className,
      )}
    >
      <Icon className={panelTitleIconClass} aria-hidden />
      <span>{children}</span>
    </h2>
  );
}

const PIPELINE_STAGE_PILL: Record<string, string> = {
  lead: 'bg-[var(--ozer-cool-blue)]/15 text-[var(--ozer-cool-blue)] border-[var(--ozer-cool-blue)]/30',
  qualified:
    'bg-[var(--ozer-sage-500)]/25 text-[var(--ozer-plum-900)] border-[var(--ozer-sage-500)]/40',
  call_booked:
    'bg-[var(--ozer-lime-400)]/35 text-[var(--ozer-plum-900)] border-[var(--ozer-lime-400)]/50',
  proposal_sent:
    'bg-[var(--ozer-orange-topaze)]/15 text-[var(--ozer-coral-600)] border-[var(--ozer-orange-topaze)]/35',
  negotiation:
    'bg-[var(--ozer-plum-900)]/12 text-[var(--ozer-plum-900)] border-[var(--ozer-plum-900)]/25 dark:bg-[var(--ozer-cream-50)]/12 dark:text-[var(--ozer-cream-50)] dark:border-[var(--ozer-cream-50)]/25',
};

const PROJECT_STATUS_PILL: Record<string, string> = {
  pending:
    'bg-[var(--ozer-cool-blue)]/15 text-[var(--ozer-cool-blue)] border-[var(--ozer-cool-blue)]/30',
  in_progress:
    'bg-[var(--ozer-orange-topaze)]/15 text-[var(--ozer-coral-600)] border-[var(--ozer-orange-topaze)]/35',
  completed:
    'bg-[var(--ozer-sage-500)]/25 text-[var(--ozer-plum-900)] border-[var(--ozer-sage-500)]/40',
  on_hold:
    'bg-[var(--ozer-lime-400)]/30 text-[var(--ozer-plum-900)] border-[var(--ozer-lime-400)]/45',
};

function formatStatusLabel(status: string) {
  return status.replace(/_/g, ' ');
}

export function DashboardStatusPill({
  status,
  label,
  kind = 'pipeline',
  count,
  className,
}: {
  status: string;
  label?: string;
  kind?: 'pipeline' | 'project';
  count?: number;
  className?: string;
}) {
  const palette =
    kind === 'project' ? PROJECT_STATUS_PILL : PIPELINE_STAGE_PILL;
  const classes =
    palette[status] ??
    'bg-[var(--workspace-shell-sidebar-accent)] text-[var(--workspace-shell-text)] border-[color:var(--workspace-shell-border)]';

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-medium capitalize',
        classes,
        className,
      )}
    >
      <span>{label ?? formatStatusLabel(status)}</span>
      {typeof count === 'number' ? (
        <span className="tabular-nums opacity-70">{count}</span>
      ) : null}
    </span>
  );
}
