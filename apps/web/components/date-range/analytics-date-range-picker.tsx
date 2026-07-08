'use client';

import { useEffect, useMemo, useState } from 'react';

import { ChevronDown, ChevronLeft, Loader2 } from 'lucide-react';
import type { DateRange } from 'react-day-picker';

import { Button } from '@kit/ui/button';
import { Calendar } from '@kit/ui/calendar';
import { Checkbox } from '@kit/ui/checkbox';
import { Input } from '@kit/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@kit/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@kit/ui/select';
import { cn } from '@kit/ui/utils';

import {
  DEFAULT_DATE_RANGE,
  formatDateRangeLabel,
  resolveAnalyticsDateRange,
  type AnalyticsDatePreset,
  type DateRangeSelection,
  type LastSubPreset,
  type LastUnit,
  type PeriodSubPreset,
} from '~/lib/date-range/analytics-date-range';

type SidebarView = 'main' | 'last' | 'period';

const LAST_PRESETS: Array<{ id: LastSubPreset; label: string }> = [
  { id: 'last_30_minutes', label: 'Last 30 minutes' },
  { id: 'last_12_hours', label: 'Last 12 hours' },
  { id: 'last_7_days', label: 'Last 7 days' },
  { id: 'last_30_days', label: 'Last 30 days' },
  { id: 'last_90_days', label: 'Last 90 days' },
  { id: 'last_365_days', label: 'Last 365 days' },
  { id: 'last_week', label: 'Last week' },
  { id: 'last_month', label: 'Last month' },
  { id: 'last_quarter', label: 'Last quarter' },
  { id: 'last_12_months', label: 'Last 12 months' },
  { id: 'last_year', label: 'Last year' },
  { id: 'last_financial_year', label: 'Last financial year' },
];

const PERIOD_PRESETS: Array<{ id: PeriodSubPreset; label: string }> = [
  { id: 'week_to_date', label: 'Week to date' },
  { id: 'month_to_date', label: 'Month to date' },
  { id: 'quarter_to_date', label: 'Quarter to date' },
  { id: 'year_to_date', label: 'Year to date' },
  { id: 'financial_year_to_date', label: 'Financial year to date' },
];

function parseIsoDate(iso: string) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y!, m! - 1, d);
}

function selectionFromIso(fromIso: string, toIso: string): DateRangeSelection {
  return {
    preset: 'custom',
    customFrom: parseIsoDate(fromIso),
    customTo: parseIsoDate(toIso),
  };
}

export function AnalyticsDateRangePicker({
  fromIso,
  toIso,
  onApply,
  isLoading = false,
  className,
}: {
  fromIso: string;
  toIso: string;
  onApply: (fromIso: string, toIso: string, selection: DateRangeSelection) => void;
  isLoading?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [view, setView] = useState<SidebarView>('main');
  const [draft, setDraft] = useState<DateRangeSelection>(() =>
    selectionFromIso(fromIso, toIso),
  );
  const [calendarRange, setCalendarRange] = useState<DateRange>(() => ({
    from: parseIsoDate(fromIso),
    to: parseIsoDate(toIso),
  }));

  const appliedLabel = useMemo(
    () => formatDateRangeLabel(selectionFromIso(fromIso, toIso)),
    [fromIso, toIso],
  );

  const draftResolved = useMemo(() => resolveAnalyticsDateRange(draft), [draft]);

  const footerLabel = useMemo(() => {
    const fmt = new Intl.DateTimeFormat('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
    return `${fmt.format(draftResolved.from)} – ${fmt.format(draftResolved.to)}`;
  }, [draftResolved.from, draftResolved.to]);

  const openPicker = () => {
    const sel = selectionFromIso(fromIso, toIso);
    setDraft(sel);
    setCalendarRange({
      from: parseIsoDate(fromIso),
      to: parseIsoDate(toIso),
    });
    setView('main');
    setOpen(true);
  };

  const apply = () => {
    let next = draft;
    if (draft.preset === 'custom' && calendarRange.from) {
      next = {
        ...draft,
        preset: 'custom',
        customFrom: calendarRange.from,
        customTo: calendarRange.to ?? calendarRange.from,
      };
    }
    const resolved = resolveAnalyticsDateRange(next);
    setIsApplying(true);
    onApply(resolved.fromIso, resolved.toIso, next);
    setOpen(false);
  };

  const pickerBusy = isLoading || isApplying;

  useEffect(() => {
    if (!isLoading) {
      setIsApplying(false);
    }
  }, [isLoading]);

  useEffect(() => {
    setIsApplying(false);
  }, [fromIso, toIso]);

  const pickLastPreset = (id: LastSubPreset) => {
    setDraft({
      preset: 'last',
      lastSubPreset: id,
      includeToday: draft.includeToday ?? true,
    });
    setView('main');
  };

  const pickPeriodPreset = (id: PeriodSubPreset) => {
    setDraft({ preset: 'period_to_date', periodSubPreset: id });
    setView('main');
  };

  const showLastControls = draft.preset === 'last' && !draft.lastSubPreset;

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setIsApplying(false);
      }}
    >
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          disabled={pickerBusy}
          className={cn(
            'border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] text-[var(--workspace-shell-text)] hover:bg-[var(--workspace-shell-sidebar-accent)]',
            pickerBusy && 'opacity-90',
            className,
          )}
          onClick={openPicker}
        >
          {pickerBusy ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin text-[var(--ozer-accent-muted)]" />
          ) : null}
          {appliedLabel}
          {!pickerBusy ? (
            <ChevronDown className="ml-2 h-4 w-4 opacity-60" />
          ) : null}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-auto max-w-[calc(100vw-2rem)] border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] p-0 text-[var(--workspace-shell-text)] shadow-xl"
      >
        <div className="flex flex-col md:flex-row">
          <aside className="w-full border-b border-[color:var(--workspace-shell-border)] md:w-52 md:border-b-0 md:border-r">
            {view !== 'main' ? (
              <button
                type="button"
                className="flex w-full items-center gap-2 border-b border-[color:var(--workspace-shell-border)] px-4 py-3 text-sm text-[var(--workspace-shell-text-muted)] hover:bg-[var(--workspace-shell-sidebar-accent)] hover:text-[var(--workspace-shell-text)]"
                onClick={() => setView('main')}
              >
                <ChevronLeft className="h-4 w-4" />
                {view === 'last' ? 'Last' : 'Period to date'}
              </button>
            ) : null}

            {view === 'main' ? (
              <div className="py-1">
                <SidebarItem
                  active={draft.preset === 'today'}
                  onClick={() => setDraft({ preset: 'today' })}
                >
                  Today
                </SidebarItem>
                <SidebarItem
                  active={draft.preset === 'yesterday'}
                  onClick={() => setDraft({ preset: 'yesterday' })}
                >
                  Yesterday
                </SidebarItem>
                <SidebarItem
                  active={draft.preset === 'last'}
                  onClick={() => setView('last')}
                  trailing={<ChevronDown className="h-4 w-4 -rotate-90 opacity-50" />}
                >
                  Last
                </SidebarItem>
                <SidebarItem
                  active={draft.preset === 'period_to_date'}
                  onClick={() => setView('period')}
                  trailing={<ChevronDown className="h-4 w-4 -rotate-90 opacity-50" />}
                >
                  Period to date
                </SidebarItem>
                <SidebarItem
                  active={draft.preset === 'custom'}
                  onClick={() =>
                    setDraft({
                      preset: 'custom',
                      customFrom: calendarRange.from,
                      customTo: calendarRange.to,
                    })
                  }
                >
                  Custom range
                </SidebarItem>
              </div>
            ) : null}

            {view === 'last' ? (
              <div className="max-h-80 overflow-y-auto py-1">
                {LAST_PRESETS.map((p) => (
                  <SidebarItem
                    key={p.id}
                    active={draft.lastSubPreset === p.id}
                    onClick={() => pickLastPreset(p.id)}
                  >
                    {p.label}
                  </SidebarItem>
                ))}
              </div>
            ) : null}

            {view === 'period' ? (
              <div className="py-1">
                {PERIOD_PRESETS.map((p) => (
                  <SidebarItem
                    key={p.id}
                    active={draft.periodSubPreset === p.id}
                    onClick={() => pickPeriodPreset(p.id)}
                  >
                    {p.label}
                  </SidebarItem>
                ))}
              </div>
            ) : null}
          </aside>

          <div className="flex min-w-0 flex-1 flex-col">
            {(showLastControls || draft.preset === 'last') && draft.preset === 'last' ? (
              <div className="flex flex-wrap items-center gap-2 border-b border-[color:var(--workspace-shell-border)] px-4 py-3">
                <span className="text-sm text-[var(--workspace-shell-text-muted)]">Last</span>
                <Input
                  type="number"
                  min={1}
                  className="h-8 w-16 border-[color:var(--workspace-shell-border)] bg-[var(--workspace-control-surface)] text-[var(--workspace-shell-text)]"
                  value={draft.lastCount ?? 30}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      preset: 'last',
                      lastSubPreset: undefined,
                      lastCount: Math.max(1, Number(e.target.value) || 1),
                    })
                  }
                />
                <Select
                  value={draft.lastUnit ?? 'days'}
                  onValueChange={(v) =>
                    setDraft({
                      ...draft,
                      preset: 'last',
                      lastSubPreset: undefined,
                      lastUnit: v as LastUnit,
                    })
                  }
                >
                  <SelectTrigger className="h-8 w-28 border-[color:var(--workspace-shell-border)] bg-[var(--workspace-control-surface)] text-[var(--workspace-shell-text)]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="days">Days</SelectItem>
                    <SelectItem value="weeks">Weeks</SelectItem>
                    <SelectItem value="months">Months</SelectItem>
                    <SelectItem value="years">Years</SelectItem>
                  </SelectContent>
                </Select>
                <label className="ml-auto flex items-center gap-2 text-xs text-[var(--workspace-shell-text-muted)]">
                  <Checkbox
                    checked={draft.includeToday !== false}
                    onCheckedChange={(checked) =>
                      setDraft({
                        ...draft,
                        includeToday: checked === true,
                      })
                    }
                  />
                  Include today
                </label>
              </div>
            ) : null}

            <div className="p-3">
              <Calendar
                mode="range"
                numberOfMonths={2}
                selected={calendarRange}
                onSelect={(range) => {
                  setCalendarRange(range ?? { from: undefined, to: undefined });
                  if (range?.from) {
                    setDraft({
                      preset: 'custom',
                      customFrom: range.from,
                      customTo: range.to ?? range.from,
                    });
                  }
                }}
                defaultMonth={calendarRange.from}
                className={cn(
                  'rounded-lg border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-canvas)] text-[var(--workspace-shell-text)]',
                  '[&_.text-muted-foreground]:text-[var(--workspace-shell-text-muted)]',
                  '[&_button]:text-[var(--workspace-shell-text)]',
                  '[&_button:hover]:bg-[var(--workspace-shell-sidebar-accent)]',
                  '[&_button[data-range-middle=true]]:bg-[var(--ozer-accent-subtle)] [&_button[data-range-middle=true]]:text-[var(--workspace-shell-text)]',
                  '[&_button[data-range-start=true]]:bg-[var(--ozer-accent)] [&_button[data-range-start=true]]:text-[var(--ozer-white)]',
                  '[&_button[data-range-end=true]]:bg-[var(--ozer-accent)] [&_button[data-range-end=true]]:text-[var(--ozer-white)]',
                  '[&_button[data-selected-single=true]]:bg-[var(--ozer-accent)] [&_button[data-selected-single=true]]:text-[var(--ozer-white)]',
                )}
                classNames={{
                  today:
                    'rounded-md bg-[var(--workspace-shell-sidebar-accent)] font-medium text-[var(--workspace-shell-text)]',
                  outside:
                    'text-[var(--workspace-shell-text-muted)] opacity-50 aria-selected:text-[var(--workspace-shell-text-muted)]',
                  weekday: 'text-[var(--workspace-shell-text-muted)]',
                  caption_label: 'text-[var(--workspace-shell-text)]',
                }}
              />
            </div>

            <div className="flex items-center justify-between gap-3 border-t border-[color:var(--workspace-shell-border)] px-4 py-3">
              <p className="text-xs text-[var(--workspace-shell-text-muted)]">{footerLabel}</p>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="border-[color:var(--workspace-shell-border)] bg-[var(--workspace-control-surface)] text-[var(--workspace-shell-text)] hover:bg-[var(--workspace-shell-sidebar-accent)]"
                  onClick={() => setOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  size="sm"
                  className="bg-[var(--ozer-accent)] text-[var(--ozer-white)] hover:bg-[var(--ozer-accent-hover)]"
                  disabled={pickerBusy}
                  onClick={apply}
                >
                  {pickerBusy ? (
                    <>
                      <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                      Applying…
                    </>
                  ) : (
                    'Apply'
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function SidebarItem({
  children,
  active,
  onClick,
  trailing,
}: {
  children: React.ReactNode;
  active?: boolean;
  onClick: () => void;
  trailing?: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex w-full items-center justify-between px-4 py-2.5 text-left text-sm transition',
        active
          ? 'bg-[var(--workspace-shell-sidebar-accent)] font-medium text-[var(--workspace-shell-text)]'
          : 'text-[var(--workspace-shell-text-muted)] hover:bg-[var(--workspace-shell-sidebar-accent)] hover:text-[var(--workspace-shell-text)]',
      )}
    >
      <span>{children}</span>
      {trailing}
    </button>
  );
}

export { DEFAULT_DATE_RANGE, type DateRangeSelection, type AnalyticsDatePreset };
