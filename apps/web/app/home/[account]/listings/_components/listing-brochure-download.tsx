'use client';

import { useState } from 'react';

import { FileText } from 'lucide-react';

import { Button } from '@kit/ui/button';

import { workspaceBtnPrimaryMd } from '~/lib/workspace-ui';

import { ListingBrochurePublishSheet } from './listing-brochure-publish-sheet';

type ListingBrochureDownloadProps = {
  listingId: string;
  accountId: string;
  accountSlug: string;
  listingName: string;
  listingAddress?: string | null;
  coverUrl?: string | null;
  defaultShowRent?: boolean;
  defaultShowPrice?: boolean;
  className?: string;
  compact?: boolean;
};

export function ListingBrochureDownload({
  listingId,
  accountId,
  accountSlug,
  listingName,
  listingAddress,
  coverUrl,
  defaultShowRent = true,
  defaultShowPrice = true,
  className,
  compact = false,
}: ListingBrochureDownloadProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className={className}>
      {!compact ? (
        <p className="mb-3 text-sm text-[var(--workspace-shell-text)]/60">
          Preview a designed PDF, publish it to Media for portals, or upload an
          external brochure.
        </p>
      ) : null}

      <Button
        type="button"
        size="sm"
        onClick={() => setOpen(true)}
        className={`gap-1.5 ${compact ? '' : workspaceBtnPrimaryMd}`}
      >
        <FileText className="h-3.5 w-3.5" />
        {compact ? 'Brochure PDF…' : 'Open brochure PDF…'}
      </Button>

      <ListingBrochurePublishSheet
        key={open ? `${listingId}-open` : `${listingId}-closed`}
        open={open}
        onOpenChange={setOpen}
        listingId={listingId}
        accountId={accountId}
        accountSlug={accountSlug}
        listingName={listingName}
        listingAddress={listingAddress}
        coverUrl={coverUrl}
        defaultShowRent={defaultShowRent}
        defaultShowPrice={defaultShowPrice}
      />
    </div>
  );
}
