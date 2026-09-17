'use client';

import { useTransition } from 'react';

import { useRouter } from 'next/navigation';

import { Button } from '@kit/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@kit/ui/popover';
import { toast } from '@kit/ui/sonner';

import type { RightmoveUnsyncedChanges } from '~/lib/commercial/rightmove-unsynced-changes';

import { republishRightmoveListingAction } from '../../commercial-publishing/_lib/server/server-actions';
import { useDisposalAccess } from './disposal-access-context';

export function ListingRightmoveWhatsChanged({
  changes,
  accountId,
  listingId,
}: {
  changes: RightmoveUnsyncedChanges;
  accountId: string;
  listingId: string;
}) {
  const router = useRouter();
  const { canEditDisposals } = useDisposalAccess();
  const [resyncPending, startResync] = useTransition();

  const resyncRightmove = () => {
    startResync(async () => {
      try {
        await republishRightmoveListingAction({
          accountId,
          listingId,
        });
        toast.success('Rightmove re-sync sent');
        router.refresh();
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : 'Could not re-sync Rightmove',
        );
      }
    });
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          data-test="rightmove-whats-changed"
          className="text-xs font-medium text-[var(--workspace-shell-text)] underline-offset-2 hover:underline focus-visible:ring-2 focus-visible:ring-[var(--ozer-accent)] focus-visible:outline-none"
        >
          What&apos;s changed
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        side="bottom"
        className="w-80 border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] p-3 text-[var(--workspace-shell-text)]"
        data-test="rightmove-whats-changed-popover"
      >
        <p className="text-sm font-medium text-[var(--workspace-shell-text)]">
          What&apos;s changed since last sync
        </p>
        <p className="mt-1 text-xs text-[var(--workspace-shell-text-muted)]">
          {changes.lastSyncText}
        </p>
        <ul className="mt-2 list-disc space-y-1 pl-4 text-xs text-[var(--workspace-shell-text)]">
          {changes.items.map((item) => (
            <li key={item.id}>{item.text}</li>
          ))}
        </ul>
        <p className="mt-2 text-[11px] leading-relaxed text-[var(--workspace-shell-text-muted)]">
          {changes.footnote}
        </p>
        {canEditDisposals ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={resyncPending}
            data-test="rightmove-whats-changed-resync"
            className="mt-3 h-8 px-2.5 text-xs"
            onClick={resyncRightmove}
          >
            {resyncPending ? 'Re-syncing…' : 'Re-sync Rightmove now'}
          </Button>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}
