'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { RefreshCw, Send } from 'lucide-react';

import { Button } from '@kit/ui/button';
import { toast } from '@kit/ui/sonner';

import { getErrorMessage } from '~/home/[account]/jobs/_lib/error-message';

import type { SignaturesMailProvider } from '../_lib/server/signatures-data';
import {
  pushAllSignaturesAction,
  syncSignaturesStaff,
} from '../_lib/server/signatures-module-actions';

export function SignaturesActionsBar({
  accountId,
  mailProvider,
  mailActionsDisabled,
  compact = false,
}: {
  accountId: string;
  mailProvider?: SignaturesMailProvider | null;
  mailActionsDisabled?: boolean;
  /** Hide the blocked helper line (e.g. when inline with tab nav). */
  compact?: boolean;
}) {
  const router = useRouter();
  const [pending, setPending] = useState<'sync' | 'push-all' | null>(null);

  const providerLabel =
    mailProvider === 'google'
      ? 'Google Workspace'
      : mailProvider === 'microsoft'
        ? 'Microsoft 365'
        : 'mail provider';

  const sync = async () => {
    setPending('sync');
    try {
      const result = await syncSignaturesStaff({ accountId });
      toast.success(`Synced ${result.synced} staff member${result.synced === 1 ? '' : 's'}`);
      if (result.errors.length) {
        toast.warning(`${result.errors.length} sync issue${result.errors.length === 1 ? '' : 's'} recorded`);
      }
      router.refresh();
    } catch (e) {
      toast.error(getErrorMessage(e));
    } finally {
      setPending(null);
    }
  };

  const pushAll = async () => {
    setPending('push-all');
    try {
      const result = await pushAllSignaturesAction({ accountId });
      toast.success(
        `Pushed ${result.succeeded} of ${result.total} signature${result.total === 1 ? '' : 's'}`,
      );
      if (result.failed) {
        toast.warning(`${result.failed} push failed`);
      }
      router.refresh();
    } catch (e) {
      toast.error(getErrorMessage(e));
    } finally {
      setPending(null);
    }
  };

  const blocked = Boolean(mailActionsDisabled);

  return (
    <div
      className={
        compact
          ? 'flex flex-wrap items-center gap-2'
          : 'flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center'
      }
    >
      {!compact && blocked ? (
        <p className="text-xs text-muted-foreground">
          Connect Microsoft 365 or Google Workspace to sync staff and push
          signatures.
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          size={compact ? 'sm' : 'default'}
          onClick={sync}
          disabled={pending !== null || blocked}
          title={
            blocked
              ? 'Requires a mail provider connection'
              : `Sync directory from ${providerLabel}`
          }
        >
          <RefreshCw className="mr-2 h-4 w-4" />
          {pending === 'sync' ? 'Syncing...' : 'Sync staff'}
        </Button>
        <Button
          type="button"
          size={compact ? 'sm' : 'default'}
          onClick={pushAll}
          disabled={pending !== null || blocked}
          title={
            blocked
              ? 'Requires a mail provider connection'
              : `Push signatures via ${providerLabel}`
          }
        >
          <Send className="mr-2 h-4 w-4" />
          {pending === 'push-all' ? 'Pushing...' : 'Push All'}
        </Button>
      </div>
    </div>
  );
}
