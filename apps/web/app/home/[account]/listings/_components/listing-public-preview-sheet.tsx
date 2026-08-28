'use client';

import { useEffect, useState } from 'react';

import { Loader2 } from 'lucide-react';

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@kit/ui/sheet';

import type { PublicBrochureData } from '~/lib/commercial/public-brochure.shared';

import type { ListingPreviewExternalLink } from '../_lib/listing-preview-links';
import { loadListingPublicPreviewAction } from '../_lib/server/server-actions';
import {
  ListingPublicPreview,
  type ListingPreviewUnit,
} from './listing-public-preview';

type PreviewPayload = {
  data: PublicBrochureData;
  sector: string | null;
  units: ListingPreviewUnit[];
  externalLinks: ListingPreviewExternalLink[];
};

type ListingPublicPreviewSheetProps = {
  accountId: string;
  listingId: string | null;
  openFullPageHref: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function ListingPublicPreviewSheet({
  accountId,
  listingId,
  openFullPageHref,
  open,
  onOpenChange,
}: ListingPublicPreviewSheetProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<PreviewPayload | null>(null);
  const showLoading = open && Boolean(listingId) && (loading || !preview) && !error;

  useEffect(() => {
    if (!open || !listingId) {
      setPreview(null);
      setError(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);
    setPreview(null);

    void loadListingPublicPreviewAction({ accountId, listingId })
      .then((payload) => {
        if (cancelled) return;
        setPreview(payload);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(
          err instanceof Error ? err.message : 'Could not load listing preview',
        );
        setPreview(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [accountId, listingId, open]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex w-full flex-col gap-0 overflow-y-auto border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] p-0 text-[var(--workspace-shell-text)] sm:max-w-5xl"
      >
        <SheetHeader className="sr-only">
          <SheetTitle>Listing preview</SheetTitle>
          <SheetDescription>
            Staff marketing preview for this disposal
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 p-4 sm:p-6">
          {showLoading ? (
            <div className="flex items-center gap-2 py-12 text-sm text-[var(--workspace-shell-text-muted)]">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading preview…
            </div>
          ) : error ? (
            <p className="py-12 text-sm text-rose-400">{error}</p>
          ) : preview ? (
            <ListingPublicPreview
              data={preview.data}
              sector={preview.sector}
              units={preview.units}
              externalLinks={preview.externalLinks}
              openFullPageHref={openFullPageHref ?? undefined}
              onClose={() => onOpenChange(false)}
            />
          ) : (
            <p className="py-12 text-sm text-[var(--workspace-shell-text-muted)]">
              Select a listing to preview.
            </p>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
