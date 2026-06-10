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
];

const PERIOD_PRESETS: Array<{ id: PeriodSubPreset; label: string }> = [
  { id: 'week_to_date', label: 'Week to date' },
  { id: 'month_to_date', label: 'Month to date' },
  { id: 'quarter_to_date', label: 'Quarter to date' },
  { id: 'year_to_date', label: 'Year to date' },
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
    if (!isLoading) setIsApplying(false);
  }, [isLoading]);

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
            'border-white/10 bg-[var(--workspace-shell-panel)] text-white hover:bg-white/5',
            pickerBusy && 'opacity-90',
            className,
          )}
          onClick={openPicker}
        >
          {pickerBusy ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin text-[#5eead4]" />
          ) : null}
          {appliedLabel}
          {!pickerBusy ? (
            <ChevronDown className="ml-2 h-4 w-4 opacity-60" />
          ) : null}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-auto max-w-[calc(100vw-2rem)] border-white/10 bg-[var(--workspace-shell-panel)] p-0 text-white shadow-xl"
      >
        <div className="flex flex-col md:flex-row">
          <aside className="w-full border-b border-white/6 md:w-52 md:border-b-0 md:border-r">
            {view !== 'main' ? (
              <button
                type="button"
                className="flex w-full items-center gap-2 border-b border-white/6 px-4 py-3 text-sm text-white/80 hover:bg-white/5"
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
              <div className="flex flex-wrap items-center gap-2 border-b border-white/6 px-4 py-3">
                <span className="text-sm text-white/70">Last</span>
                <Input
                  type="number"
                  min={1}
                  className="h-8 w-16 border-white/10 bg-transparent text-white"
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
                  <SelectTrigger className="h-8 w-28 border-white/10 bg-transparent text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="days">Days</SelectItem>
                    <SelectItem value="weeks">Weeks</SelectItem>
                    <SelectItem value="months">Months</SelectItem>
                    <SelectItem value="years">Years</SelectItem>
                  </SelectContent>
                </Select>
                <label className="ml-auto flex items-center gap-2 text-xs text-white/70">
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
                className="rounded-lg border border-white/6 bg-[var(--workspace-shell-canvas)] text-white"
              />
            </div>

            <div className="flex items-center justify-between gap-3 border-t border-white/6 px-4 py-3">
              <p className="text-xs text-white/60">{footerLabel}</p>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="border-white/10"
                  onClick={() => setOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  size="sm"
                  className="bg-[#2A9D8F] text-white hover:bg-[#238b7f]"
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
          ? 'bg-white/8 font-medium text-white'
          : 'text-white/75 hover:bg-white/5 hover:text-white',
      )}
    >
      <span>{children}</span>
      {trailing}
    </button>
  );
}

export { DEFAULT_DATE_RANGE, type DateRangeSelection, type AnalyticsDatePreset };
