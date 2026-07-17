'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';

import Link from 'next/link';

import { format } from 'date-fns';
import { CalendarIcon, Loader2 } from 'lucide-react';
import type { UseFormReturn } from 'react-hook-form';

import { Button } from '@kit/ui/button';
import { Calendar } from '@kit/ui/calendar';
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@kit/ui/form';
import { Input } from '@kit/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@kit/ui/popover';
import { toast } from '@kit/ui/sonner';
import { Switch } from '@kit/ui/switch';
import { cn } from '@kit/ui/utils';

import pathsConfig from '~/config/paths.config';
import { workAccountPath } from '~/home/[account]/_lib/work-account-path';
import type {
  GmailVacationStatus,
  WorkspaceFocusSettings,
} from '~/home/[account]/settings/focus/_lib/focus-settings.schema';
import {
  getGmailVacationStatus,
  syncHolidayModeToGmail,
  turnOffGmailVacationResponder,
} from '~/home/[account]/settings/focus/actions';

import {
  type FocusFormValues,
  HOLIDAY_LABEL_PRESETS,
  holidayUntilToIso,
  parseHolidayUntilDate,
  toWorkspaceFocusPreview,
} from '../_lib/focus-form';
import { FocusStatusBadge } from './FocusStatusBadge';

type HolidayModeSectionProps = {
  form: UseFormReturn<FocusFormValues>;
  accountId: string;
  accountSlug: string;
  userId: string;
  persisted: WorkspaceFocusSettings | null;
};

export function HolidayModeSection({
  form,
  accountId,
  accountSlug,
  userId,
  persisted,
}: HolidayModeSectionProps) {
  const [pending, startTransition] = useTransition();
  const [gmailStatus, setGmailStatus] = useState<
    GmailVacationStatus | 'loading'
  >('loading');
  const values = form.watch();
  const holidayEnabled = values.holiday_mode_enabled;
  const previewSettings = toWorkspaceFocusPreview(values, accountId, persisted);

  const focusReturnPath = workAccountPath(
    pathsConfig.app.accountFocusSettings,
    accountSlug,
  );
  const reconnectHref = `/api/google/connect?returnPath=${encodeURIComponent(focusReturnPath)}`;

  useEffect(() => {
    let cancelled = false;

    void getGmailVacationStatus(userId).then((status) => {
      if (!cancelled) {
        setGmailStatus(status);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [userId]);

  const gmailResponderOn = useMemo(() => {
    if (
      gmailStatus === 'loading' ||
      gmailStatus === 'not_connected' ||
      gmailStatus === 'scope_missing' ||
      gmailStatus === null
    ) {
      return false;
    }

    return gmailStatus.enableAutoReply;
  }, [gmailStatus]);

  const gmailPanelState = useMemo(() => {
    if (gmailStatus === 'loading' || gmailStatus === 'not_connected') {
      return 'hidden' as const;
    }

    if (gmailStatus === 'scope_missing') {
      return 'scope_missing' as const;
    }

    if (holidayEnabled && gmailResponderOn) {
      return 'in_sync' as const;
    }

    if (!holidayEnabled && gmailResponderOn) {
      return 'gmail_on_ozer_off' as const;
    }

    if (holidayEnabled && !gmailResponderOn) {
      return 'ozer_on_gmail_off' as const;
    }

    return 'both_off' as const;
  }, [gmailResponderOn, gmailStatus, holidayEnabled]);

  function refreshGmailStatus() {
    void getGmailVacationStatus(userId).then(setGmailStatus);
  }

  function runGmailAction(
    action: () => Promise<{ success: boolean; error?: string }>,
  ) {
    startTransition(async () => {
      const result = await action();

      if (!result.success) {
        toast.error(result.error ?? 'Gmail sync failed');
        return;
      }

      toast.success('Gmail vacation responder updated');
      refreshGmailStatus();
    });
  }

  return (
    <section className="rounded-2xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] p-5">
      <div className="space-y-1">
        <h2 className="text-base font-semibold text-[var(--workspace-shell-text)]">
          Holiday & away mode
        </h2>
        <p className="text-sm text-[var(--workspace-shell-text-muted)]">
          Let teammates and contacts know you&apos;re away.
        </p>
      </div>

      <div className="mt-5 space-y-4">
        <FormField
          control={form.control}
          name="holiday_mode_enabled"
          render={({ field }) => (
            <FormItem className="flex items-center justify-between gap-4 rounded-xl border border-[color:var(--workspace-shell-border)]/80 bg-[var(--workspace-shell-panel)]/30 p-4">
              <FormLabel className="text-sm font-medium text-[var(--workspace-shell-text)]">
                I&apos;m currently away
              </FormLabel>
              <FormControl>
                <Switch
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
              </FormControl>
            </FormItem>
          )}
        />

        <div
          className={cn(
            'grid transition-[grid-template-rows] duration-300 ease-out',
            holidayEnabled ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]',
          )}
        >
          <div className="overflow-hidden">
            <div className="space-y-4 pt-1">
              <FormField
                control={form.control}
                name="holiday_mode_label"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-[var(--workspace-shell-text-muted)]">
                      Label
                    </FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        className="border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)]/40 text-[var(--workspace-shell-text)]"
                      />
                    </FormControl>
                    <div className="flex flex-wrap gap-2 pt-1">
                      {HOLIDAY_LABEL_PRESETS.map((preset) => (
                        <button
                          key={preset}
                          type="button"
                          className="rounded-full border border-[color:var(--workspace-shell-border)] px-3 py-1 text-xs text-[var(--workspace-shell-text-muted)] transition-colors hover:border-[color:var(--workspace-shell-border)] hover:text-[var(--workspace-shell-text)]"
                          onClick={() => field.onChange(preset)}
                        >
                          {preset}
                        </button>
                      ))}
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="holiday_mode_until"
                render={({ field }) => {
                  const selectedDate = parseHolidayUntilDate(field.value);

                  return (
                    <FormItem className="flex flex-col">
                      <FormLabel className="text-[var(--workspace-shell-text-muted)]">
                        Back on (optional)
                      </FormLabel>
                      <Popover>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              type="button"
                              variant="outline"
                              className={cn(
                                'w-full justify-start border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)]/40 text-left font-normal text-[var(--workspace-shell-text)] hover:bg-[var(--workspace-control-surface)] hover:text-[var(--workspace-shell-text)]',
                                !selectedDate &&
                                  'text-[var(--workspace-shell-text-muted)]',
                              )}
                            >
                              <CalendarIcon className="mr-2 h-4 w-4" />
                              {selectedDate
                                ? format(selectedDate, 'PPP')
                                : 'Pick a date'}
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent
                          className="w-auto border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] p-0"
                          align="start"
                        >
                          <Calendar
                            mode="single"
                            selected={selectedDate}
                            onSelect={(date) => {
                              field.onChange(
                                date ? holidayUntilToIso(date) : null,
                              );
                            }}
                            disabled={(date) =>
                              date < new Date(new Date().setHours(0, 0, 0, 0))
                            }
                            initialFocus
                          />
                          {selectedDate ? (
                            <div className="border-t border-[color:var(--workspace-shell-border)] p-2">
                              <Button
                                type="button"
                                variant="ghost"
                                className="w-full text-[var(--workspace-shell-text-muted)] hover:text-[var(--workspace-shell-text)]"
                                onClick={() => field.onChange(null)}
                              >
                                Clear date
                              </Button>
                            </div>
                          ) : null}
                        </PopoverContent>
                      </Popover>
                      <FormDescription className="text-[var(--workspace-shell-text-muted)]">
                        {field.value
                          ? 'Holiday mode will automatically turn off on this date'
                          : 'Leave blank to keep holiday mode on indefinitely'}
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  );
                }}
              />

              <div className="flex flex-wrap items-center gap-2 rounded-xl border border-[color:var(--workspace-shell-border)]/80 bg-[var(--workspace-shell-panel)]/20 px-3 py-2 text-sm text-[var(--workspace-shell-text-muted)]">
                <span>Your status will show as:</span>
                <FocusStatusBadge
                  settings={previewSettings}
                  enableHolidayAutoDisable={Boolean(persisted)}
                />
              </div>
            </div>
          </div>
        </div>

        {gmailPanelState !== 'hidden' ? (
          <GmailVacationSyncPanel
            state={gmailPanelState}
            pending={pending}
            reconnectHref={reconnectHref}
            onTurnOffGmail={() =>
              runGmailAction(() => turnOffGmailVacationResponder(userId))
            }
            onTurnOnHolidayMode={() =>
              form.setValue('holiday_mode_enabled', true, { shouldDirty: true })
            }
            onSyncToGmail={() =>
              runGmailAction(() => syncHolidayModeToGmail(accountId, userId))
            }
          />
        ) : null}
      </div>
    </section>
  );
}

function GmailVacationSyncPanel({
  state,
  pending,
  reconnectHref,
  onTurnOffGmail,
  onTurnOnHolidayMode,
  onSyncToGmail,
}: {
  state:
    | 'scope_missing'
    | 'in_sync'
    | 'gmail_on_ozer_off'
    | 'ozer_on_gmail_off'
    | 'both_off';
  pending: boolean;
  reconnectHref: string;
  onTurnOffGmail: () => void;
  onTurnOnHolidayMode: () => void;
  onSyncToGmail: () => void;
}) {
  if (state === 'scope_missing') {
    return (
      <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-100">
        <p className="font-medium">Reconnect Google to enable Gmail sync</p>
        <p className="mt-1 text-xs text-amber-100/80">
          Your Google account was connected before vacation replies were
          supported. A quick reconnect adds this permission.
        </p>
        <Button asChild size="sm" className="mt-3" variant="outline">
          <Link href={reconnectHref}>Reconnect Google</Link>
        </Button>
      </div>
    );
  }

  if (state === 'in_sync') {
    return (
      <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
        ✓ Gmail vacation responder is in sync
      </div>
    );
  }

  if (state === 'gmail_on_ozer_off') {
    return (
      <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-100">
        <p>
          Your Gmail vacation responder is currently on but holiday mode is off
          in Ozer.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={pending}
            onClick={onTurnOffGmail}
          >
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Turn off in Gmail
          </Button>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            disabled={pending}
            onClick={onTurnOnHolidayMode}
          >
            Turn on holiday mode
          </Button>
        </div>
      </div>
    );
  }

  if (state === 'ozer_on_gmail_off') {
    return (
      <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-100">
        <p>
          Holiday mode is on but your Gmail vacation responder isn&apos;t
          active.
        </p>
        <Button
          type="button"
          size="sm"
          className="mt-3"
          disabled={pending}
          onClick={onSyncToGmail}
        >
          {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Sync to Gmail
        </Button>
      </div>
    );
  }

  return null;
}
