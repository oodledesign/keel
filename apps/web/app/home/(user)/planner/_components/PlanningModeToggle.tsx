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
      <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-white/55">
        <CalendarDays className="h-4 w-4 text-[#5eead4]" />
        Planning mode
      </div>
      <div className="grid grid-cols-2 gap-2">
        {(['day', 'week'] as const).map((value) => (
          <Button
            key={value}
            type="button"
            variant="outline"
            className={cn(
              'border-white/10 bg-white/5 text-white/70 hover:bg-white/10 hover:text-white',
              mode === value &&
                'border-[var(--keel-teal)]/50 bg-[var(--keel-teal)]/15 text-[#5eead4]',
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
        className="border-white/10 bg-white/5 text-white"
      />
    </div>
  );
}
