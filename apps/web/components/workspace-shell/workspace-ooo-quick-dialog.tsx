'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';

import Link from 'next/link';

import { format } from 'date-fns';
import { CalendarIcon, Loader2, Plane } from 'lucide-react';

import { useUser } from '@kit/supabase/hooks/use-user';
import { Button } from '@kit/ui/button';
import { Calendar } from '@kit/ui/calendar';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@kit/ui/dialog';
import { Label } from '@kit/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@kit/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@kit/ui/select';
import { toast } from '@kit/ui/sonner';
import { Switch } from '@kit/ui/switch';
import { Textarea } from '@kit/ui/textarea';
import { cn } from '@kit/ui/utils';

import {
  GmailVacationSyncPanel,
  type GmailVacationSyncPanelState,
} from '~/components/workspace-shell/gmail-vacation-sync-panel';
import pathsConfig from '~/config/paths.config';
import { workAccountPath } from '~/home/[account]/_lib/work-account-path';
import {
  FOCUS_FORM_DEFAULTS,
  HOLIDAY_LABEL_PRESETS,
  buildFocusFormDefaults,
  holidayUntilToIso,
  parseHolidayUntilDate,
} from '~/home/[account]/settings/focus/_lib/focus-form';
import type { GmailVacationStatus } from '~/home/[account]/settings/focus/_lib/focus-settings.schema';
import {
  getGmailVacationStatus,
  getWorkspaceFocusSettings,
  reconcileGmailVacationWithHolidayMode,
  syncHolidayModeToGmail,
  turnOffGmailVacationResponder,
  upsertWorkspaceFocusSettings,
} from '~/home/[account]/settings/focus/actions';
import { useWorkspaceFocusSnapshot } from '~/lib/hooks/use-workspace-focus';

import { useWorkspaceFocusSettingsMutations } from './workspace-focus-context';
import type { WorkspaceOooWorkspaceOption } from './workspace-ooo-dialog-context';

type WorkspaceOooQuickDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accountId: string | null;
  accountSlug: string | null;
  workspaces: WorkspaceOooWorkspaceOption[];
  onAccountChange: (accountId: string) => void;
};

export function WorkspaceOooQuickDialog({
  open,
  onOpenChange,
  accountId,
  accountSlug,
  workspaces,
  onAccountChange,
}: WorkspaceOooQuickDialogProps) {
  const [pending, startTransition] = useTransition();
  const [gmailPending, startGmailTransition] = useTransition();
  const [loading, setLoading] = useState(false);
  const { replaceSettings } = useWorkspaceFocusSettingsMutations();
  const userState = useUser();
  const userId = userState.data?.id ?? null;

  const [away, setAway] = useState(false);
  const [label, setLabel] = useState('Holiday');
  const [until, setUntil] = useState<string | null>(null);
  const [oooEnabled, setOooEnabled] = useState(false);
  const [oooMessage, setOooMessage] = useState('');
  const [baseline, setBaseline] = useState(FOCUS_FORM_DEFAULTS);
  const [gmailStatus, setGmailStatus] = useState<
    GmailVacationStatus | 'loading'
  >('loading');

  const selectedDate = parseHolidayUntilDate(until);
  const previewSettings = useMemo(
    () => ({
      ...baseline,
      account_id: accountId ?? undefined,
      holiday_mode_enabled: away,
      holiday_mode_label: label,
      holiday_mode_until: until,
      ooo_enabled: oooEnabled,
      ooo_message: oooMessage,
      ooo_trigger: away ? ('holiday_only' as const) : baseline.ooo_trigger,
    }),
    [accountId, away, baseline, label, oooEnabled, oooMessage, until],
  );
  const focusState = useWorkspaceFocusSnapshot(previewSettings);

  const settingsHref =
    accountSlug != null
      ? workAccountPath(pathsConfig.app.accountFocusSettings, accountSlug)
      : null;
  const reconnectHref =
    settingsHref != null
      ? `/api/google/connect?returnPath=${encodeURIComponent(settingsHref)}`
      : '/api/google/connect';

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

  const gmailPanelState = useMemo((): GmailVacationSyncPanelState => {
    if (gmailStatus === 'loading' || gmailStatus === 'not_connected') {
      return 'hidden';
    }

    if (gmailStatus === 'scope_missing') {
      return 'scope_missing';
    }

    if (away && gmailResponderOn) {
      return 'in_sync';
    }

    if (!away && gmailResponderOn) {
      return 'gmail_on_ozer_off';
    }

    if (away && !gmailResponderOn) {
      return 'ozer_on_gmail_off';
    }

    return 'both_off';
  }, [away, gmailResponderOn, gmailStatus]);

  useEffect(() => {
    if (!open || !accountId) {
      return;
    }

    let cancelled = false;
    setLoading(true);
    setGmailStatus('loading');

    void getWorkspaceFocusSettings(accountId)
      .then((settings) => {
        if (cancelled) return;

        const defaults = buildFocusFormDefaults(settings);
        setBaseline(defaults);
        setAway(defaults.holiday_mode_enabled);
        setLabel(defaults.holiday_mode_label || 'Holiday');
        setUntil(defaults.holiday_mode_until);
        setOooEnabled(defaults.ooo_enabled);
        setOooMessage(defaults.ooo_message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [accountId, open]);

  useEffect(() => {
    // Wait until focus settings finished loading so we don't reconcile against
    // the default "away=false" before the real holiday flag is known.
    if (!open || !accountId || !userId || loading) {
      return;
    }

    let cancelled = false;

    void (async () => {
      if (!away) {
        const reconcile =
          await reconcileGmailVacationWithHolidayMode(accountId);
        if (cancelled) return;

        if (reconcile.success === false && reconcile.error) {
          console.error(
            '[ooo-quick] Gmail vacation reconcile:',
            reconcile.error,
          );
        }
      }

      const status = await getGmailVacationStatus(userId);
      if (!cancelled) {
        setGmailStatus(status);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [accountId, away, loading, open, userId]);

  function refreshGmailStatus() {
    if (!userId) return;
    void getGmailVacationStatus(userId).then(setGmailStatus);
  }

  function runGmailAction(
    action: () => Promise<{ success: boolean; error?: string }>,
  ) {
    startGmailTransition(async () => {
      const result = await action();

      if (!result.success) {
        toast.error(result.error ?? 'Gmail sync failed');
        return;
      }

      toast.success('Gmail vacation responder updated');
      refreshGmailStatus();
    });
  }

  function handleSave() {
    if (!accountId) {
      toast.error('Select a workspace to update out of office settings');
      return;
    }

    if (oooEnabled && !oooMessage.trim()) {
      toast.error('Add a short out of office message before enabling replies');
      return;
    }

    const nextValues = {
      ...baseline,
      holiday_mode_enabled: away,
      holiday_mode_label: label.trim() || 'Holiday',
      holiday_mode_until: until,
      ooo_enabled: oooEnabled,
      ooo_message: oooMessage.trim(),
      ooo_trigger: away
        ? baseline.ooo_trigger === 'manual'
          ? ('holiday_only' as const)
          : baseline.ooo_trigger
        : baseline.ooo_trigger,
    };

    startTransition(async () => {
      const result = await upsertWorkspaceFocusSettings(accountId, nextValues);

      if (!result.success) {
        toast.error(result.error ?? 'Could not save out of office settings');
        return;
      }

      replaceSettings(accountId, {
        ...nextValues,
        account_id: accountId,
      });

      if (result.gmailSyncError) {
        toast.warning('Saved. Gmail sync failed — retry from Focus settings.');
      } else {
        toast.success(
          result.gmailSynced
            ? 'Out of office updated (Gmail synced)'
            : 'Out of office updated',
        );
      }

      onOpenChange(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md gap-0 overflow-hidden border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] p-0 text-[var(--workspace-shell-text)] sm:rounded-2xl">
        <DialogHeader className="space-y-1 border-b border-[color:var(--workspace-shell-border)] px-5 py-4 text-left">
          <DialogTitle className="flex items-center gap-2 text-base">
            <Plane className="h-4 w-4 text-[var(--ozer-accent)]" aria-hidden />
            Out of office
          </DialogTitle>
          <DialogDescription className="text-[var(--workspace-shell-text-muted)]">
            Quick away status and auto-replies for this workspace.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 px-5 py-4">
          {workspaces.length > 1 ? (
            <div className="space-y-2">
              <Label className="text-[var(--workspace-shell-text-muted)]">
                Workspace
              </Label>
              <Select
                value={accountId ?? undefined}
                onValueChange={onAccountChange}
              >
                <SelectTrigger className="border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)]/40">
                  <SelectValue placeholder="Choose a workspace" />
                </SelectTrigger>
                <SelectContent>
                  {workspaces.map((workspace) => (
                    <SelectItem key={workspace.id} value={workspace.id}>
                      {workspace.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}

          {loading ? (
            <div className="flex items-center justify-center gap-2 py-8 text-sm text-[var(--workspace-shell-text-muted)]">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading…
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between gap-4 rounded-xl border border-[color:var(--workspace-shell-border)]/80 bg-[var(--workspace-shell-panel)]/30 px-3 py-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium">I&apos;m currently away</p>
                  <p className="text-xs text-[var(--workspace-shell-text-muted)]">
                    Shows as holiday / away to teammates
                  </p>
                </div>
                <Switch checked={away} onCheckedChange={setAway} />
              </div>

              {away ? (
                <div className="space-y-3">
                  <div className="flex flex-wrap gap-2">
                    {HOLIDAY_LABEL_PRESETS.map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        className={cn(
                          'rounded-full border px-3 py-1 text-xs transition-colors',
                          label === preset
                            ? 'border-[color:var(--ozer-accent)] bg-[color-mix(in_srgb,var(--ozer-accent)_12%,transparent)] text-[var(--workspace-shell-text)]'
                            : 'border-[color:var(--workspace-shell-border)] text-[var(--workspace-shell-text-muted)] hover:text-[var(--workspace-shell-text)]',
                        )}
                        onClick={() => setLabel(preset)}
                      >
                        {preset}
                      </button>
                    ))}
                  </div>

                  <div className="space-y-2">
                    <Label className="text-[var(--workspace-shell-text-muted)]">
                      Back on (optional)
                    </Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          type="button"
                          variant="outline"
                          className={cn(
                            'w-full justify-start border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)]/40 text-left font-normal',
                            !selectedDate &&
                              'text-[var(--workspace-shell-text-muted)]',
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {selectedDate
                            ? format(selectedDate, 'PPP')
                            : 'Pick a date'}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent
                        className="w-auto border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] p-0"
                        align="start"
                      >
                        <Calendar
                          mode="single"
                          selected={selectedDate}
                          onSelect={(date) => {
                            setUntil(date ? holidayUntilToIso(date) : null);
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
                              className="w-full"
                              onClick={() => setUntil(null)}
                            >
                              Clear date
                            </Button>
                          </div>
                        ) : null}
                      </PopoverContent>
                    </Popover>
                  </div>

                  <p className="text-xs text-[var(--workspace-shell-text-muted)]">
                    Status preview:{' '}
                    <span className="font-medium text-[var(--workspace-shell-text)]">
                      {focusState.currentStatusLabel}
                    </span>
                  </p>
                </div>
              ) : null}

              <div className="flex items-center justify-between gap-4 rounded-xl border border-[color:var(--workspace-shell-border)]/80 bg-[var(--workspace-shell-panel)]/30 px-3 py-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium">
                    Enable out of office replies
                  </p>
                  <p className="text-xs text-[var(--workspace-shell-text-muted)]">
                    Auto-reply to incoming messages
                  </p>
                </div>
                <Switch checked={oooEnabled} onCheckedChange={setOooEnabled} />
              </div>

              {oooEnabled ? (
                <div className="space-y-2">
                  <Label className="text-[var(--workspace-shell-text-muted)]">
                    Reply message
                  </Label>
                  <Textarea
                    value={oooMessage}
                    onChange={(event) => setOooMessage(event.target.value)}
                    rows={4}
                    placeholder="Thanks for your message — I'm away and will reply when I'm back."
                    className="border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)]/40"
                  />
                </div>
              ) : null}

              {userId ? (
                <GmailVacationSyncPanel
                  state={gmailPanelState}
                  pending={gmailPending}
                  reconnectHref={reconnectHref}
                  hideInSync
                  onTurnOffGmail={() =>
                    runGmailAction(() => turnOffGmailVacationResponder(userId))
                  }
                  onTurnOnHolidayMode={() => setAway(true)}
                  onSyncToGmail={() => {
                    if (!accountId) return;
                    runGmailAction(() =>
                      syncHolidayModeToGmail(accountId, userId),
                    );
                  }}
                />
              ) : null}
            </>
          )}
        </div>

        <DialogFooter className="flex-col gap-2 border-t border-[color:var(--workspace-shell-border)] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          {settingsHref ? (
            <Button
              asChild
              type="button"
              variant="ghost"
              className="justify-start px-0 text-[var(--workspace-shell-text-muted)] hover:bg-transparent hover:text-[var(--workspace-shell-text)]"
            >
              <Link href={settingsHref} onClick={() => onOpenChange(false)}>
                Full Focus settings
              </Link>
            </Button>
          ) : (
            <span />
          )}

          <div className="flex w-full gap-2 sm:w-auto">
            <Button
              type="button"
              variant="outline"
              className="flex-1 sm:flex-none"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              className="ozer-gradient-btn flex-1 sm:flex-none"
              disabled={pending || loading || !accountId}
              onClick={handleSave}
            >
              {pending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving…
                </>
              ) : (
                'Save'
              )}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
