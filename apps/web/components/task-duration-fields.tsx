'use client';

import { Clock } from 'lucide-react';

import { Input } from '@kit/ui/input';
import { Label } from '@kit/ui/label';
import { cn } from '@kit/ui/utils';

import {
  combineDurationParts,
  formatDurationMinutes,
  splitDurationMinutes,
} from '~/lib/tasks/task-duration';

const FIELD_CLASS =
  'border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] text-[var(--workspace-shell-text)]';

export function TaskDurationFields({
  value,
  onChange,
  disabled,
  idPrefix = 'task-duration',
  compact = false,
}: {
  value: number | null;
  onChange: (next: number | null) => void;
  disabled?: boolean;
  idPrefix?: string;
  compact?: boolean;
}) {
  const parts = splitDurationMinutes(value);
  const hours = value == null ? '' : String(parts.hours || '');
  const minutes = value == null ? '' : String(parts.minutes || '');

  const update = (nextHours: string, nextMinutes: string) => {
    const parsedHours = nextHours.trim() === '' ? 0 : Number(nextHours);
    const parsedMinutes = nextMinutes.trim() === '' ? 0 : Number(nextMinutes);
    if (
      (nextHours.trim() === '' && nextMinutes.trim() === '') ||
      Number.isNaN(parsedHours) ||
      Number.isNaN(parsedMinutes)
    ) {
      onChange(null);
      return;
    }
    onChange(combineDurationParts(parsedHours, parsedMinutes));
  };

  return (
    <div className={cn('space-y-2', compact && 'space-y-1')}>
      {compact ? null : (
        <Label
          htmlFor={`${idPrefix}-hours`}
          className="text-[var(--workspace-shell-text-muted)]"
        >
          Duration
        </Label>
      )}
      <div className="flex items-center gap-2">
        <Input
          id={`${idPrefix}-hours`}
          type="number"
          min={0}
          max={168}
          inputMode="numeric"
          placeholder="0"
          disabled={disabled}
          value={hours}
          onChange={(event) => update(event.target.value, minutes)}
          className={cn(
            FIELD_CLASS,
            compact ? 'h-8 w-14 text-sm' : 'h-10 w-16',
          )}
          aria-label="Duration hours"
        />
        <span className="text-xs text-[var(--workspace-shell-text-muted)]">
          h
        </span>
        <Input
          id={`${idPrefix}-minutes`}
          type="number"
          min={0}
          max={59}
          inputMode="numeric"
          placeholder="00"
          disabled={disabled}
          value={minutes}
          onChange={(event) => update(hours, event.target.value)}
          className={cn(
            FIELD_CLASS,
            compact ? 'h-8 w-14 text-sm' : 'h-10 w-16',
          )}
          aria-label="Duration minutes"
        />
        <span className="text-xs text-[var(--workspace-shell-text-muted)]">
          m
        </span>
      </div>
    </div>
  );
}

export function TaskDurationMeta({
  minutes,
  className,
}: {
  minutes: number | null | undefined;
  className?: string;
}) {
  const label = formatDurationMinutes(minutes);
  if (!label) return null;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 text-xs text-[var(--workspace-shell-text-muted)]',
        className,
      )}
      title={`Estimated duration ${label}`}
    >
      <Clock className="h-3 w-3 shrink-0" aria-hidden />
      {label}
    </span>
  );
}
