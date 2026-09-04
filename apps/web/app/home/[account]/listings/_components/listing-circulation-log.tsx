'use client';

import { useEffect, useState } from 'react';

import { toast } from '@kit/ui/sonner';

import type { CirculationSendLog } from '~/lib/commercial/circulation/circulate-listing';

import { listListingCirculationSends } from '../_lib/server/circulation-actions';

type Props = {
  accountId: string;
  listingId: string;
};

function formatWhen(iso: string) {
  return new Date(iso).toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function ListingCirculationLog({ accountId, listingId }: Props) {
  const [sends, setSends] = useState<CirculationSendLog[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    listListingCirculationSends({ accountId, listingId })
      .then((rows) => {
        if (!cancelled) setSends(rows);
      })
      .catch((err) => {
        toast.error(
          err instanceof Error ? err.message : 'Could not load send log',
        );
        if (!cancelled) setSends([]);
      });
    return () => {
      cancelled = true;
    };
  }, [accountId, listingId]);

  if (sends == null) {
    return (
      <p className="text-sm text-[var(--workspace-shell-text-muted)]">
        Loading send log…
      </p>
    );
  }

  if (sends.length === 0) {
    return (
      <p className="text-sm text-[var(--workspace-shell-text-muted)]">
        No circulation sends yet for this disposal.
      </p>
    );
  }

  return (
    <ul className="space-y-3">
      {sends.map((send) => (
        <li
          key={send.id}
          className="rounded-md border border-[var(--workspace-shell-border)] px-3 py-2"
        >
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="text-sm font-medium text-[var(--workspace-shell-text)]">
              {send.subject}
            </p>
            <p className="text-xs text-[var(--workspace-shell-text-muted)]">
              {formatWhen(send.createdAt)} · {send.sendTrigger} ·{' '}
              {send.recipientCount} sent · {send.deliveredCount} delivered ·{' '}
              {send.openCount} opens · {send.clickCount} clicks
              {send.bounceCount ? ` · ${send.bounceCount} bounces` : ''}
              {send.complaintCount ? ` · ${send.complaintCount} complaints` : ''}
            </p>
          </div>
          {send.fromEmail ? (
            <p className="mt-0.5 text-xs text-[var(--workspace-shell-text-muted)]">
              From {send.fromName ? `${send.fromName} ` : ''}
              &lt;{send.fromEmail}&gt;
            </p>
          ) : null}
          <ul className="mt-2 space-y-1">
            {send.recipients.map((recipient) => (
              <li
                key={recipient.id}
                className="text-xs text-[var(--workspace-shell-text-muted)]"
              >
                {recipient.email} · {recipient.status}
                {recipient.skipReason ? ` (${recipient.skipReason})` : ''}
                {recipient.deliveredAt ? ' · delivered' : ''}
                {recipient.openedAt
                  ? ` · opened${recipient.openCount > 1 ? ` ×${recipient.openCount}` : ''}`
                  : ''}
                {recipient.clickedAt
                  ? ` · clicked${recipient.clickCount > 1 ? ` ×${recipient.clickCount}` : ''}`
                  : ''}
                {recipient.bouncedAt
                  ? ` · bounced${recipient.bounceType ? ` (${recipient.bounceType})` : ''}`
                  : ''}
                {recipient.complaintAt ? ' · complaint' : ''}
                {recipient.errorMessage ? ` · ${recipient.errorMessage}` : ''}
              </li>
            ))}
          </ul>
        </li>
      ))}
    </ul>
  );
}
