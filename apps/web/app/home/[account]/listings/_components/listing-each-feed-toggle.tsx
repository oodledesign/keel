'use client';

import { useState, useTransition } from 'react';

import { useRouter } from 'next/navigation';

import { toast } from '@kit/ui/sonner';
import { Switch } from '@kit/ui/switch';

import { setEachListingFeedInclusionAction } from '../../commercial-publishing/_lib/server/server-actions';

export function ListingEachFeedToggle({
  accountId,
  listingId,
  initialEnabled,
  compact = false,
}: {
  accountId: string;
  listingId: string;
  initialEnabled: boolean;
  /** Tighter layout for overview header. */
  compact?: boolean;
}) {
  const router = useRouter();
  const [enabled, setEnabled] = useState(initialEnabled);
  const [pending, startTransition] = useTransition();

  const onCheckedChange = (next: boolean) => {
    const previous = enabled;
    setEnabled(next);
    startTransition(async () => {
      try {
        const result = await setEachListingFeedInclusionAction({
          accountId,
          listingId,
          enabled: next,
        });
        setEnabled(result.enabled);
        toast.success(
          result.enabled
            ? 'EACH: included in feed (when on-market)'
            : 'EACH: switched off for this disposal',
        );
        router.refresh();
      } catch (error) {
        setEnabled(previous);
        toast.error(
          error instanceof Error ? error.message : 'Could not update EACH',
        );
      }
    });
  };

  return (
    <div
      className={
        compact
          ? 'flex items-center justify-between gap-3 rounded-lg border border-[color:var(--workspace-shell-border)] px-3 py-2'
          : 'flex items-center justify-between gap-3'
      }
    >
      <div className="min-w-0">
        <p className="text-sm font-medium text-[var(--workspace-shell-text)]">
          EACH feed
        </p>
        {!compact ? (
          <p className="text-xs text-[var(--workspace-shell-text)]/55">
            On by default for Marketing / Under offer. Switch off to exclude
            this disposal from the EACH XML feed.
          </p>
        ) : (
          <p className="text-[11px] text-[var(--workspace-shell-text)]/50">
            {enabled ? 'Included when on-market' : 'Excluded from feed'}
          </p>
        )}
      </div>
      <Switch
        checked={enabled}
        disabled={pending}
        onCheckedChange={onCheckedChange}
        aria-label="Include listing in EACH feed"
      />
    </div>
  );
}
