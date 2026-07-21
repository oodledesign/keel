'use client';

import { useEffect, useState } from 'react';

import Link from 'next/link';

import { ExternalLink, Loader2 } from 'lucide-react';

import { Button } from '@kit/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@kit/ui/sheet';

import { getBrainSourcePreviewAction } from '../_lib/server/brain-actions';

type PreviewRef = {
  source_type: string;
  source_id: string;
  title: string;
  url?: string;
  score: number;
  chunkText?: string;
};

function highlightContent(content: string, chunk?: string) {
  const needle = chunk?.trim();
  if (!needle)
    return (
      <p className="text-sm whitespace-pre-wrap text-[var(--workspace-shell-text)]">
        {content}
      </p>
    );

  const index = content.indexOf(needle);
  if (index < 0) {
    return (
      <div className="space-y-3">
        <p className="text-sm whitespace-pre-wrap text-[var(--workspace-shell-text)]">
          {content}
        </p>
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3">
          <p className="mb-1 text-xs font-medium text-amber-200">
            Matched excerpt
          </p>
          <p className="text-sm whitespace-pre-wrap text-[var(--workspace-shell-text)]">
            {needle}
          </p>
        </div>
      </div>
    );
  }

  return (
    <p className="text-sm whitespace-pre-wrap text-[var(--workspace-shell-text)]">
      {content.slice(0, index)}
      <mark className="rounded bg-[var(--ozer-accent-subtle)] px-0.5 text-[var(--workspace-shell-text)]">
        {content.slice(index, index + needle.length)}
      </mark>
      {content.slice(index + needle.length)}
    </p>
  );
}

export function BrainSourcePreviewDrawer({
  accountId,
  accountSlug,
  previewRef,
  onClose,
}: {
  accountId: string;
  accountSlug: string;
  previewRef: PreviewRef | null;
  onClose: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<{
    title: string;
    sourceType: string;
    updatedAt: string | null;
    content: string;
    sourceUrl: string;
  } | null>(null);

  useEffect(() => {
    if (!previewRef) {
      setPreview(null);
      return;
    }

    setLoading(true);
    void getBrainSourcePreviewAction({
      accountId,
      accountSlug,
      sourceType: previewRef.source_type as
        | 'note'
        | 'doc'
        | 'job'
        | 'job_note'
        | 'phase'
        | 'transcript'
        | 'proposal'
        | 'task'
        | 'email_thread',
      sourceId: previewRef.source_id,
      highlightText: previewRef.chunkText,
    })
      .then((data) => setPreview(data))
      .catch(() => setPreview(null))
      .finally(() => setLoading(false));
  }, [accountId, accountSlug, previewRef]);

  return (
    <Sheet
      open={Boolean(previewRef)}
      onOpenChange={(open) => !open && onClose()}
    >
      <SheetContent
        side="right"
        className="w-full border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] text-[var(--workspace-shell-text)] sm:max-w-lg"
      >
        <SheetHeader>
          <SheetTitle className="text-[var(--workspace-shell-text)]">
            {preview?.title ?? previewRef?.title ?? 'Source'}
          </SheetTitle>
          <SheetDescription className="text-[var(--workspace-shell-text-muted)]">
            {preview?.sourceType?.replace('_', ' ') ?? previewRef?.source_type}
            {preview?.updatedAt
              ? ` · Updated ${new Date(preview.updatedAt).toLocaleDateString('en-GB')}`
              : null}
          </SheetDescription>
        </SheetHeader>

        <div className="mt-4 max-h-[60vh] overflow-y-auto rounded-lg border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)]/50 p-4">
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-[var(--workspace-shell-text-muted)]">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading source…
            </div>
          ) : preview ? (
            highlightContent(preview.content, previewRef?.chunkText)
          ) : (
            <p className="text-sm text-[var(--workspace-shell-text-muted)]">
              Could not load this source.
            </p>
          )}
        </div>

        {(preview?.sourceUrl ?? previewRef?.url) && (
          <Button
            asChild
            className="mt-4 w-full bg-[var(--ozer-accent)] text-[var(--ozer-white)] hover:bg-[var(--ozer-accent-hover)]"
          >
            <Link href={preview?.sourceUrl ?? previewRef?.url ?? '#'}>
              <ExternalLink className="mr-2 h-4 w-4" />
              Go to source
            </Link>
          </Button>
        )}
      </SheetContent>
    </Sheet>
  );
}
