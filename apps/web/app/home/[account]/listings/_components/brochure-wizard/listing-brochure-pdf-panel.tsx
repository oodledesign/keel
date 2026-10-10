'use client';

import { useRef, useState, useTransition } from 'react';

import { useRouter } from 'next/navigation';

import { FileText, Loader2, Upload } from 'lucide-react';

import { getSupabaseBrowserClient } from '@kit/supabase/browser-client';
import { Button } from '@kit/ui/button';
import { toast } from '@kit/ui/sonner';
import { cn } from '@kit/ui/utils';

import {
  type BrochureStatus,
  type BrochureStatusRecord,
  brochureStatus,
} from '~/lib/commercial/brochure-pdf/brochure-status';

import { createListingMedia } from '../../_lib/server/server-actions';
import type { BrochureWizardChannel } from './brochure-wizard';
import { BrochureWizardDialog } from './brochure-wizard-dialog';

const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;

function safeFileName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]+/g, '-').slice(0, 120);
}

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
      return { label: 'Not created', detail: null };
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
  const uploadInputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [uploading, startUpload] = useTransition();
  const status = brochureStatus(records);
  const { label, detail } = statusText(status);

  function uploadExternal(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    startUpload(async () => {
      try {
        if (file.type && file.type !== 'application/pdf') {
          throw new Error('Please upload a PDF file');
        }
        if (file.size > MAX_UPLOAD_BYTES) {
          throw new Error('PDF must be 20MB or smaller');
        }

        const client = getSupabaseBrowserClient();
        const path = `${accountId}/${listingId}/${crypto.randomUUID()}-${safeFileName(file.name)}`;
        const { error: uploadError } = await client.storage
          .from('commercial-listing-media')
          .upload(path, file, {
            contentType: 'application/pdf',
            upsert: false,
          });
        if (uploadError) throw new Error(uploadError.message);

        await createListingMedia({
          accountId,
          listingId,
          mediaType: 'brochure',
          storagePath: path,
          fileName: file.name,
          mimeType: 'application/pdf',
          sortOrder: 0,
        });

        toast.success('Brochure PDF added to Media → Brochure.');
        router.refresh();
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : 'Could not upload brochure PDF',
        );
      } finally {
        if (uploadInputRef.current) uploadInputRef.current.value = '';
      }
    });
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
          <input
            ref={uploadInputRef}
            type="file"
            accept="application/pdf"
            className="hidden"
            onChange={(e) => uploadExternal(e.target.files)}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1.5"
            disabled={!canEdit || uploading}
            onClick={() => uploadInputRef.current?.click()}
          >
            {uploading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Upload className="h-3.5 w-3.5" />
            )}
            Upload PDF
          </Button>
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
