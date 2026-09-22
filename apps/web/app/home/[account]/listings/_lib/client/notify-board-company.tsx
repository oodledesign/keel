'use client';

import { useCallback, useState } from 'react';

import {
  type BoardNotifyStatus,
  isBoardNotifyStatus,
} from '~/lib/commercial/board-company-settings';

import { NotifyBoardCompanyDialog } from '../../_components/notify-board-company-dialog';

const handledKeys = new Set<string>();

function transitionKey(listingId: string, status: string) {
  return `${listingId}:${status}`;
}

/**
 * After a disposal flips to Under offer / Let / Sold, open a confirm-first
 * board-company notify prompt (non-blocking of the status save itself).
 */
export function useNotifyBoardCompanyPrompt(input: {
  accountId: string;
  accountSlug?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [listingId, setListingId] = useState<string | null>(null);
  const [status, setStatus] = useState<BoardNotifyStatus | null>(null);

  const maybePrompt = useCallback(
    (params: {
      listingId: string;
      previousStatus: string | null | undefined;
      nextStatus: string;
    }) => {
      if (!isBoardNotifyStatus(params.nextStatus)) return;
      if (params.previousStatus === params.nextStatus) return;

      const key = transitionKey(params.listingId, params.nextStatus);
      if (handledKeys.has(key)) return;
      handledKeys.add(key);

      // Leaving this status later should allow a fresh prompt on return.
      if (params.previousStatus && isBoardNotifyStatus(params.previousStatus)) {
        handledKeys.delete(
          transitionKey(params.listingId, params.previousStatus),
        );
      }

      setListingId(params.listingId);
      setStatus(params.nextStatus);
      setOpen(true);
    },
    [],
  );

  const dialog =
    listingId && status ? (
      <NotifyBoardCompanyDialog
        open={open}
        onOpenChange={setOpen}
        accountId={input.accountId}
        accountSlug={input.accountSlug}
        listingId={listingId}
        status={status}
      />
    ) : null;

  return { maybePrompt, dialog };
}
