'use client';

import { useState } from 'react';

import { useRouter } from 'next/navigation';

import { Download, FileText, Loader2 } from 'lucide-react';

import { Button } from '@kit/ui/button';
import { toast } from '@kit/ui/sonner';
import { cn } from '@kit/ui/utils';

import {
  type BrochureStatus,
  type BrochureStatusRecord,
  brochureStatus,
} from '~/lib/commercial/brochure-pdf/brochure-status';

import { type BrochureWizardChannel, filenameFrom } from './brochure-wizard';
import { BrochureWizardDialog } from './brochure-wizard-dialog';

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'Europe/London',
  });
}

function statusText(status: BrochureStatus) {
  switch (status.kind) {
    case 'not_created':
      return {
        label: 'Not created',
        detail: 'Have your own PDF? Upload it in Media → Brochure.',
      };
    case 'draft':
      return {
        label: 'Draft',
        detail: 'Not published yet. Only a published brochure goes to feeds.',
      };
    case 'published':
      return {
        label: `Published on ${formatDate(status.approvedAt)}${
          status.approvedByName ? ` by ${status.approvedByName}` : ''
        }`,
        detail: null,
      };
    case 'edited':
      return {
        label: 'Edited since publishing',
        detail: `Feeds still have the version published on ${formatDate(
          status.approvedAt,
        )}. Review and publish again to update them.`,
      };
  }
}

export function ListingBrochurePdfPanel({
  listingId,
  accountId,
  listingName,
  records,
  channels,
  defaultShowRent,
  defaultShowPrice,
  canEdit,
}: {
  listingId: string;
  accountId: string;
  listingName: string;
  records: BrochureStatusRecord[];
  channels: BrochureWizardChannel[];
  defaultShowRent: boolean;
  defaultShowPrice: boolean;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const status = brochureStatus(records);
  const { label, detail } = statusText(status);
  const hasDraft = status.kind === 'draft' || status.kind === 'edited';

  async function downloadDraft() {
    if (status.kind !== 'draft' && status.kind !== 'edited') return;
    setDownloading(true);
    try {
      const params = new URLSearchParams({
        listingId,
        accountId,
        orientation: status.orientation,
        useSaved: '1',
      });
      const res = await fetch(`/api/listings/brochure-pdf?${params}`);
      if (!res.ok) throw new Error('The draft PDF could not be built.');
      const blob = await res.blob();
      const name = filenameFrom(
        res.headers.get('Content-Disposition'),
        `${listingName || 'brochure'}.pdf`,
      ).replace(/\.pdf$/i, '-draft.pdf');
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = name;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      toast.error('The draft PDF could not be built. Try again in a moment.');
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-[var(--workspace-shell-text)]">
            PDF brochure
          </p>
          <p
            className={cn(
              'flex items-center gap-1.5 text-xs',
              status.kind === 'edited'
                ? 'text-[var(--ozer-accent)]'
                : 'text-[var(--workspace-shell-text-muted)]',
            )}
          >
            <FileText className="h-3.5 w-3.5 shrink-0" />
            {label}
          </p>
          {detail ? (
            <p className="mt-0.5 text-xs text-[var(--workspace-shell-text-muted)]">
              {detail}
            </p>
          ) : null}
        </div>
        <div className="flex shrink-0 gap-2">
          {hasDraft && canEdit ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1.5"
              disabled={downloading}
              onClick={() => void downloadDraft()}
            >
              {downloading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Download className="h-3.5 w-3.5" />
              )}
              {downloading ? 'Building PDF…' : 'Download draft'}
            </Button>
          ) : null}
          <Button
            type="button"
            size="sm"
            disabled={!canEdit}
            onClick={() => setOpen(true)}
          >
            {status.kind === 'not_created'
              ? 'Create brochure'
              : 'Review brochure'}
          </Button>
        </div>
      </div>

      <BrochureWizardDialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) router.refresh();
        }}
        listingId={listingId}
        accountId={accountId}
        listingName={listingName}
        initialOrientation={
          status.kind === 'not_created' ? 'landscape' : status.orientation
        }
        defaultShowRent={defaultShowRent}
        defaultShowPrice={defaultShowPrice}
        channels={channels}
      />
    </div>
  );
}
