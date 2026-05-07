'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { RefreshCw, Send } from 'lucide-react';

import { Button } from '@kit/ui/button';
import { toast } from '@kit/ui/sonner';

import { getErrorMessage } from '~/home/[account]/jobs/_lib/error-message';

import {
  pushAllSignaturesAction,
  syncSignaturesStaff,
} from '../_lib/server/signatures-module-actions';

export function SignaturesActionsBar({
  accountId,
  graphActionsDisabled,
}: {
  accountId: string;
  /** UX preview without MS 365 — disables Sync / Push (Graph). */
  graphActionsDisabled?: boolean;
}) {
  const router = useRouter();
  const [pending, setPending] = useState<'sync' | 'push-all' | null>(null);

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

  const blocked = Boolean(graphActionsDisabled);

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
      {blocked ? (
        <p className="text-xs text-muted-foreground">
          Connect Microsoft 365 to sync staff and push signatures.
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={sync}
          disabled={pending !== null || blocked}
          title={
            blocked
              ? 'Requires Microsoft 365 connection'
              : 'Sync directory from Microsoft 365'
          }
        >
          <RefreshCw className="mr-2 h-4 w-4" />
          {pending === 'sync' ? 'Syncing...' : 'Sync from M365'}
        </Button>
        <Button
          type="button"
          onClick={pushAll}
          disabled={pending !== null || blocked}
          title={
            blocked
              ? 'Requires Microsoft 365 connection'
              : 'Push signatures to Outlook'
          }
        >
          <Send className="mr-2 h-4 w-4" />
          {pending === 'push-all' ? 'Pushing...' : 'Push All'}
        </Button>
      </div>
    </div>
  );
}
