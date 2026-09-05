'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { Card, CardContent, CardHeader, CardTitle } from '@kit/ui/card';
import { Label } from '@kit/ui/label';
import { Textarea } from '@kit/ui/textarea';

import { workspacePanelCard } from '~/lib/workspace-ui';

import type { CommercialListing } from '../_lib/server/listings.service';
import { updateListing } from '../_lib/server/server-actions';
import { useDisposalAccess } from './disposal-access-context';

type AutosaveStatus = 'idle' | 'saving' | 'saved' | 'error';

const AUTOSAVE_MS = 800;

export function ListingInternalNotesCard({
  accountId,
  listing,
}: {
  accountId: string;
  listing: CommercialListing;
}) {
  const { canEditDisposals } = useDisposalAccess();
  const readOnly = !canEditDisposals;
  const [value, setValue] = useState(listing.notes ?? '');
  const [status, setStatus] = useState<AutosaveStatus>('idle');
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestValue = useRef(value);
  const listingId = listing.id;

  useEffect(() => {
    setValue(listing.notes ?? '');
    latestValue.current = listing.notes ?? '';
    setStatus('idle');
  }, [listing.id, listing.notes]);

  const persist = useCallback(
    async (notes: string) => {
      if (readOnly) return;
      setStatus('saving');
      try {
        await updateListing({
          accountId,
          listingId,
          notes: notes.trim() || null,
        });
        setStatus('saved');
      } catch {
        setStatus('error');
      }
    },
    [accountId, listingId, readOnly],
  );

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, []);

  const onChange = (next: string) => {
    setValue(next);
    latestValue.current = next;
    if (readOnly) return;
    setStatus('idle');
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      void persist(latestValue.current);
    }, AUTOSAVE_MS);
  };

  const statusLabel =
    status === 'saving'
      ? 'Saving…'
      : status === 'saved'
        ? 'Saved'
        : status === 'error'
          ? 'Could not save'
          : null;

  return (
    <Card className={workspacePanelCard}>
      <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
        <div className="space-y-1">
          <CardTitle className="text-base text-[var(--workspace-shell-text)]">
            Internal notes
          </CardTitle>
          <p className="text-sm text-[var(--workspace-shell-text)]/50">
            Team only — not shown on brochures, feeds, circulation, or public
            share pages.
          </p>
        </div>
        {statusLabel ? (
          <p
            className={`text-xs ${
              status === 'error'
                ? 'text-rose-600 dark:text-rose-400'
                : 'text-[var(--workspace-shell-text)]/45'
            }`}
          >
            {statusLabel}
          </p>
        ) : null}
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          <Label
            htmlFor={`listing-internal-notes-${listingId}`}
            className="sr-only"
          >
            Internal notes
          </Label>
          <Textarea
            id={`listing-internal-notes-${listingId}`}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            rows={5}
            disabled={readOnly}
            placeholder="Internal notes (team only)"
            className="min-h-[120px] resize-y"
          />
        </div>
      </CardContent>
    </Card>
  );
}
