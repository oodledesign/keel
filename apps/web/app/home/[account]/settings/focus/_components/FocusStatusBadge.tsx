'use client';

import { Clock, Mail } from 'lucide-react';

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@kit/ui/tooltip';
import { cn } from '@kit/ui/utils';

import type { WorkspaceFocusSettings } from '~/home/[account]/settings/focus/actions';
import useWorkspaceFocus, {
  useWorkspaceFocusSnapshot,
} from '~/lib/hooks/use-workspace-focus';
import type { WorkspaceFocusInput } from '~/lib/workspace-focus';

import { holidayEmoji } from '../_lib/focus-form';

type FocusStatusBadgeProps = {
  settings: WorkspaceFocusInput | WorkspaceFocusSettings | null;
  compact?: boolean;
  /** Settings page only — auto-clears expired holiday mode in the database. */
  enableHolidayAutoDisable?: boolean;
};

function StatusIcon({
  variant,
  label,
}: {
  variant: ReturnType<typeof useWorkspaceFocus>['currentStatusVariant'];
  label: string;
}) {
  if (variant === 'holiday') {
    return <span aria-hidden>{holidayEmoji(label)}</span>;
  }

  if (variant === 'muted') {
    return <Clock className="h-3.5 w-3.5" aria-hidden />;
  }

  if (variant === 'ooo') {
    return <Mail className="h-3.5 w-3.5" aria-hidden />;
  }

  return (
    <span
      className="h-2 w-2 rounded-full bg-emerald-400"
      aria-hidden
    />
  );
}

export function FocusStatusBadge({
  settings,
  compact = false,
  enableHolidayAutoDisable = false,
}: FocusStatusBadgeProps) {
  const snapshotState = useWorkspaceFocusSnapshot(settings);
  const managedState = useWorkspaceFocus(
    enableHolidayAutoDisable ? (settings as WorkspaceFocusSettings | null) : null,
  );
  const state = enableHolidayAutoDisable ? managedState : snapshotState;
  const label = state.currentStatusLabel;

  const pill = (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium',
        state.currentStatusVariant === 'active' &&
          'border-emerald-500/30 bg-emerald-500/10 text-emerald-100',
        state.currentStatusVariant === 'muted' &&
          'border-zinc-600 bg-zinc-800/80 text-zinc-300',
        state.currentStatusVariant === 'holiday' &&
          'border-amber-500/30 bg-amber-500/10 text-amber-100',
        state.currentStatusVariant === 'ooo' &&
          'border-sky-500/30 bg-sky-500/10 text-sky-100',
        compact && 'px-2 py-1',
      )}
    >
      <StatusIcon
        variant={state.currentStatusVariant}
        label={settings?.holiday_mode_label ?? label}
      />
      {!compact ? <span>{label}</span> : null}
    </span>
  );

  if (!compact) {
    return pill;
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>{pill}</TooltipTrigger>
        <TooltipContent>{label}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
