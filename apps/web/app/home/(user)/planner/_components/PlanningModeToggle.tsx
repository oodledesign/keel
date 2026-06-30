'use client';

import { CalendarDays } from 'lucide-react';

import { Button } from '@kit/ui/button';
import { Input } from '@kit/ui/input';
import { cn } from '@kit/ui/utils';

import type { PlanningMode } from './planner-types';

type Props = {
  mode: PlanningMode;
  onModeChange: (mode: PlanningMode) => void;
  date: string;
  onDateChange: (date: string) => void;
};

function dateInputValue(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString().slice(0, 10);
}

export function PlanningModeToggle({
  mode,
  onModeChange,
  date,
  onDateChange,
}: Props) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-[var(--workspace-shell-text)]/55">
        <CalendarDays className="h-4 w-4 text-[var(--ozer-accent-muted)]" />
        Planning mode
      </div>
      <div className="grid grid-cols-2 gap-2">
        {(['day', 'week'] as const).map((value) => (
          <Button
            key={value}
            type="button"
            variant="outline"
            className={cn(
              'border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] text-[var(--workspace-shell-text)]/70 hover:bg-[var(--workspace-shell-sidebar-accent)] hover:text-[var(--workspace-shell-text)]',
              mode === value &&
                'border-[var(--ozer-accent)]/50 bg-[var(--ozer-accent-subtle)] text-[var(--ozer-accent-muted)]',
            )}
            onClick={() => onModeChange(value)}
          >
            {value === 'day' ? 'Plan today' : 'Plan this week'}
          </Button>
        ))}
      </div>
      <Input
        type="date"
        value={dateInputValue(date)}
        onChange={(e) =>
          onDateChange(new Date(`${e.target.value}T12:00:00`).toISOString())
        }
        className="border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] text-[var(--workspace-shell-text)]"
      />
    </div>
  );
}
