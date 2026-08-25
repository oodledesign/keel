'use client';

import Link from 'next/link';

import { Loader2 } from 'lucide-react';

import { Button } from '@kit/ui/button';

export type GmailVacationSyncPanelState =
  | 'scope_missing'
  | 'in_sync'
  | 'gmail_on_ozer_off'
  | 'ozer_on_gmail_off'
  | 'both_off'
  | 'hidden';

type GmailVacationSyncPanelProps = {
  state: GmailVacationSyncPanelState;
  pending: boolean;
  reconnectHref: string;
  onTurnOffGmail: () => void;
  onTurnOnHolidayMode: () => void;
  onSyncToGmail: () => void;
  /** Hide the green “in sync” success panel (useful in compact dialogs). */
  hideInSync?: boolean;
};

export function GmailVacationSyncPanel({
  state,
  pending,
  reconnectHref,
  onTurnOffGmail,
  onTurnOnHolidayMode,
  onSyncToGmail,
  hideInSync = false,
}: GmailVacationSyncPanelProps) {
  if (state === 'hidden' || state === 'both_off') {
    return null;
  }

  if (state === 'scope_missing') {
    return (
      <div className="rounded-xl border border-[color-mix(in_srgb,var(--ozer-coral-500)_35%,transparent)] bg-[color-mix(in_srgb,var(--ozer-coral-500)_10%,var(--workspace-shell-panel))] p-4 text-sm text-[var(--workspace-shell-text)]">
        <p className="font-medium">Reconnect Google to enable Gmail sync</p>
        <p className="mt-1 text-xs text-[var(--workspace-shell-text-muted)]">
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
    if (hideInSync) {
      return null;
    }

    return (
      <div className="rounded-xl border border-emerald-600/25 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-900 dark:text-emerald-100">
        <p className="font-medium">✓ Gmail vacation responder is in sync</p>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="mt-3 border-emerald-700/30 text-emerald-950 hover:bg-emerald-500/10 dark:border-emerald-400/30 dark:text-emerald-100"
          disabled={pending}
          onClick={onSyncToGmail}
        >
          {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Push latest to Gmail
        </Button>
      </div>
    );
  }

  if (state === 'gmail_on_ozer_off') {
    return (
      <div className="rounded-xl border border-[color-mix(in_srgb,var(--ozer-coral-500)_35%,transparent)] bg-[color-mix(in_srgb,var(--ozer-coral-500)_10%,var(--workspace-shell-panel))] p-4 text-sm text-[var(--workspace-shell-text)]">
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
            className="ozer-gradient-btn"
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
      <div className="rounded-xl border border-[color-mix(in_srgb,var(--ozer-coral-500)_35%,transparent)] bg-[color-mix(in_srgb,var(--ozer-coral-500)_10%,var(--workspace-shell-panel))] p-4 text-sm text-[var(--workspace-shell-text)]">
        <p>
          Holiday mode is on but your Gmail vacation responder isn&apos;t
          active.
        </p>
        <Button
          type="button"
          size="sm"
          className="ozer-gradient-btn mt-3"
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
