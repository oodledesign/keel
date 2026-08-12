'use client';

import { useEffect, useState } from 'react';

import { format, isValid, parse } from 'date-fns';
import { CalendarDays } from 'lucide-react';

import { Button } from '@kit/ui/button';
import { Calendar } from '@kit/ui/calendar';
import { Input } from '@kit/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@kit/ui/popover';
import { cn } from '@kit/ui/utils';

import {
  parseDueDateParts,
  toIsoDateString,
  todayLocalYmd,
} from '~/home/_lib/due-date-ymd';
import { parseRelativeDueDatePhrase } from '~/lib/quick-action/relative-dates';

type Props = {
  value: string | null;
  onChange: (next: string | null) => void;
  className?: string;
  inputClassName?: string;
  /** Reference day for relative phrases like "tomorrow" (defaults to today). */
  referenceYmd?: string | null;
  id?: string;
  disabled?: boolean;
};

function ymdToLocalDate(ymd: string): Date | undefined {
  const parts = parseDueDateParts(ymd);
  if (!parts) return undefined;
  return new Date(parts.y, parts.m - 1, parts.d, 12, 0, 0, 0);
}

function referenceDate(referenceYmd?: string | null): Date {
  const iso = toIsoDateString(referenceYmd) ?? todayLocalYmd();
  return ymdToLocalDate(iso) ?? new Date();
}

/** Accept typed ISO, UK-style, or relative phrases; return YYYY-MM-DD or null. */
export function parseTypedDueDate(
  raw: string,
  referenceYmd?: string | null,
): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const iso = toIsoDateString(trimmed);
  if (iso) return iso;

  const ref = referenceDate(referenceYmd);

  for (const pattern of ['dd/MM/yyyy', 'd/M/yyyy', 'dd-MM-yyyy', 'd-M-yyyy']) {
    const parsed = parse(trimmed, pattern, ref);
    if (isValid(parsed)) {
      return format(parsed, 'yyyy-MM-dd');
    }
  }

  return parseRelativeDueDatePhrase(trimmed, ref);
}

export function DueDateInput({
  value,
  onChange,
  className,
  inputClassName,
  referenceYmd,
  id,
  disabled,
}: Props) {
  const [text, setText] = useState(value ?? '');
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setText(value ?? '');
  }, [value]);

  const selected = value ? ymdToLocalDate(value) : undefined;

  const commitText = (raw: string) => {
    const next = parseTypedDueDate(raw, referenceYmd);
    setText(next ?? raw.trim());
    onChange(next);
  };

  return (
    <div className={cn('flex items-center gap-1.5', className)}>
      <Input
        id={id}
        value={text}
        disabled={disabled}
        placeholder="YYYY-MM-DD or tomorrow"
        onChange={(e) => setText(e.target.value)}
        onBlur={() => commitText(text)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            commitText(text);
          }
        }}
        className={cn('min-w-0 flex-1', inputClassName)}
      />
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="icon"
            disabled={disabled}
            aria-label="Pick due date"
            className="shrink-0 border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] text-[var(--workspace-shell-text)]"
          >
            <CalendarDays className="h-4 w-4" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          align="end"
          className="w-auto border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] p-0 text-[var(--workspace-shell-text)]"
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <Calendar
            mode="single"
            selected={selected}
            defaultMonth={selected ?? referenceDate(referenceYmd)}
            onSelect={(date) => {
              if (!date) return;
              const next = format(date, 'yyyy-MM-dd');
              setText(next);
              onChange(next);
              setOpen(false);
            }}
          />
          {value ? (
            <div className="border-t border-[color:var(--workspace-shell-border)] p-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="w-full"
                onClick={() => {
                  setText('');
                  onChange(null);
                  setOpen(false);
                }}
              >
                Clear date
              </Button>
            </div>
          ) : null}
        </PopoverContent>
      </Popover>
    </div>
  );
}
