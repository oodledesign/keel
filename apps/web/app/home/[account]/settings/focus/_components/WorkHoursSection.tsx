'use client';

import { useMemo, useState } from 'react';

import { Check, ChevronsUpDown } from 'lucide-react';
import type { UseFormReturn } from 'react-hook-form';

import { Button } from '@kit/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@kit/ui/command';
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@kit/ui/form';
import { Popover, PopoverContent, PopoverTrigger } from '@kit/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@kit/ui/select';
import { Switch } from '@kit/ui/switch';
import { cn } from '@kit/ui/utils';

import {
  FOCUS_TIMEZONE_OPTIONS,
  formatFocusTimeOptions,
  formatTimezoneLabel,
  WORK_DAY_CHIPS,
  type FocusFormValues,
} from '../_lib/focus-form';

type WorkHoursSectionProps = {
  form: UseFormReturn<FocusFormValues>;
};

export function WorkHoursSection({ form }: WorkHoursSectionProps) {
  const [timezoneOpen, setTimezoneOpen] = useState(false);
  const timeOptions = useMemo(() => formatFocusTimeOptions(), []);
  const silenceOutsideHours = form.watch('silence_outside_hours');

  return (
    <section className="rounded-2xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] p-5">
      <div className="space-y-1">
        <h2 className="text-base font-semibold text-[var(--workspace-shell-text)]">Work hours</h2>
        <p className="text-sm text-[var(--workspace-shell-text-muted)]">
          Activity outside these hours can be silenced for this workspace.
        </p>
      </div>

      <div className="mt-5 space-y-5">
        <FormField
          control={form.control}
          name="work_days"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-[var(--workspace-shell-text-muted)]">Work days</FormLabel>
              <FormControl>
                <div
                  role="group"
                  aria-label="Work days"
                  className="flex flex-wrap gap-2"
                >
                  {WORK_DAY_CHIPS.map((day) => {
                    const active = field.value.includes(day.value);

                    return (
                      <button
                        key={day.value}
                        type="button"
                        aria-pressed={active}
                        className={cn(
                          'min-w-[3rem] rounded-full border px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ozer-accent)]',
                          active
                            ? 'border-[var(--ozer-accent)] bg-[var(--ozer-accent)] text-[var(--ozer-white)]'
                            : 'border-[color:var(--workspace-shell-border)] bg-transparent text-[var(--workspace-shell-text-muted)] hover:border-[color:var(--workspace-shell-border)] hover:text-[var(--workspace-shell-text)]',
                        )}
                        onClick={() => {
                          const next = active
                            ? field.value.filter((value) => value !== day.value)
                            : [...field.value, day.value].sort(
                                (a, b) => a - b,
                              );

                          field.onChange(next);
                        }}
                      >
                        {day.label}
                      </button>
                    );
                  })}
                </div>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="work_start_time"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-[var(--workspace-shell-text-muted)]">From</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger className="border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)]/40 text-[var(--workspace-shell-text)]">
                      <SelectValue placeholder="Start time" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent className="max-h-60 border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)]">
                    {timeOptions.map((time) => (
                      <SelectItem key={`start-${time}`} value={time}>
                        {time}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="work_end_time"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-[var(--workspace-shell-text-muted)]">To</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger className="border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)]/40 text-[var(--workspace-shell-text)]">
                      <SelectValue placeholder="End time" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent className="max-h-60 border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)]">
                    {timeOptions.map((time) => (
                      <SelectItem key={`end-${time}`} value={time}>
                        {time}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="timezone"
          render={({ field }) => (
            <FormItem className="flex flex-col">
              <FormLabel className="text-[var(--workspace-shell-text-muted)]">Timezone</FormLabel>
              <Popover open={timezoneOpen} onOpenChange={setTimezoneOpen}>
                <PopoverTrigger asChild>
                  <FormControl>
                    <Button
                      type="button"
                      variant="outline"
                      role="combobox"
                      aria-expanded={timezoneOpen}
                      className="w-full justify-between border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)]/40 text-[var(--workspace-shell-text)] hover:bg-[var(--workspace-control-surface)] hover:text-[var(--workspace-shell-text)]"
                    >
                      {formatTimezoneLabel(field.value)}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </FormControl>
                </PopoverTrigger>
                <PopoverContent
                  className="w-[var(--radix-popover-trigger-width)] border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] p-0"
                  align="start"
                >
                  <Command className="bg-[var(--workspace-shell-panel)]">
                    <CommandInput
                      placeholder="Search timezones…"
                      className="border-[color:var(--workspace-shell-border)] bg-[var(--workspace-control-surface)] text-[var(--workspace-shell-text)] placeholder:text-[var(--workspace-shell-text-muted)]"
                    />
                    <CommandList>
                      <CommandEmpty>No timezone found.</CommandEmpty>
                      <CommandGroup>
                        {FOCUS_TIMEZONE_OPTIONS.map((timezone) => (
                          <CommandItem
                            key={timezone}
                            value={`${timezone} ${formatTimezoneLabel(timezone)}`}
                            onSelect={() => {
                              field.onChange(timezone);
                              setTimezoneOpen(false);
                            }}
                            className="text-[var(--workspace-shell-text-muted)] aria-selected:bg-[var(--workspace-control-surface)]"
                          >
                            <Check
                              className={cn(
                                'mr-2 h-4 w-4',
                                field.value === timezone
                                  ? 'opacity-100'
                                  : 'opacity-0',
                              )}
                            />
                            {formatTimezoneLabel(timezone)}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="silence_outside_hours"
          render={({ field }) => (
            <FormItem className="rounded-xl border border-[color:var(--workspace-shell-border)]/80 bg-[var(--workspace-shell-panel)]/30 p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <FormLabel className="text-sm font-medium text-[var(--workspace-shell-text)]">
                    Silence this workspace outside work hours
                  </FormLabel>
                  {silenceOutsideHours ? (
                    <FormDescription className="text-[var(--workspace-shell-text-muted)]">
                      Notifications will be muted and this workspace will be
                      dimmed in your sidebar outside these hours.
                    </FormDescription>
                  ) : null}
                </div>
                <FormControl>
                  <Switch
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                </FormControl>
              </div>
            </FormItem>
          )}
        />
      </div>
    </section>
  );
}
