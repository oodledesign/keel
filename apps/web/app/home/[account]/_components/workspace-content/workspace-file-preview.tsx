'use client';

import { useEffect, useState } from 'react';

import { ExternalLink, Loader2 } from 'lucide-react';

import { Button } from '@kit/ui/button';
import { cn } from '@kit/ui/utils';

import { getWorkspaceDocDownloadUrlAction } from '~/home/[account]/_lib/workspace-content/docs-actions';
import { isPreviewableMimeType } from '~/home/[account]/_lib/workspace-content/types';

type WorkspaceFilePreviewProps = {
  accountId: string;
  docId: string;
  mimeType: string | null;
  title: string;
  className?: string;
  /** Shorter preview so form fields stay visible in side sheets. */
  compact?: boolean;
  /** Fill a dialog side panel with a taller preview. */
  panel?: boolean;
};

export function WorkspaceFilePreview({
  accountId,
  docId,
  mimeType,
  title,
  className,
  compact = false,
  panel = false,
}: WorkspaceFilePreviewProps) {
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const canPreview = isPreviewableMimeType(mimeType);

  useEffect(() => {
    if (!canPreview) {
      setUrl(null);
      setError(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);
    setUrl(null);

    void getWorkspaceDocDownloadUrlAction({ accountId, docId })
      .then(({ url: signedUrl }) => {
        if (cancelled) return;
        if (!signedUrl) {
          setError('Preview unavailable');
          return;
        }
        setUrl(signedUrl);
      })
      .catch(() => {
        if (!cancelled) setError('Could not load preview');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [accountId, canPreview, docId]);

  if (!canPreview) return null;

  const isImage = Boolean(mimeType?.startsWith('image/'));
  const isPdf =
    mimeType === 'application/pdf' || mimeType === 'application/x-pdf';
  const imageMaxClass = panel
    ? 'max-h-[min(28rem,55dvh)]'
    : compact
      ? 'max-h-[12rem]'
      : 'max-h-[28rem]';
  const frameHeightClass = panel
    ? 'h-[min(32rem,60dvh)]'
    : compact
      ? 'h-[14rem]'
      : 'h-[28rem]';
  const minHeightClass = panel
    ? 'min-h-[16rem]'
    : compact
      ? 'min-h-[8rem]'
      : 'min-h-[12rem]';

  return (
    <div
      className={cn(
        'overflow-hidden rounded-xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)]',
        panel && 'flex h-full min-h-0 flex-col',
        className,
      )}
    >
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-[color:var(--workspace-shell-border)] px-3 py-2">
        <p className="text-xs font-medium text-[var(--workspace-shell-text-muted)]">
          Preview
        </p>
        {url ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 gap-1 px-2 text-xs text-[var(--workspace-shell-text-muted)] hover:text-[var(--workspace-shell-text)]"
            asChild
          >
            <a href={url} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-3.5 w-3.5" />
              Open
            </a>
          </Button>
        ) : null}
      </div>

      <div
        className={cn(
          'relative flex items-center justify-center p-3',
          panel && 'min-h-0 flex-1',
          minHeightClass,
        )}
      >
        {loading ? (
          <Loader2 className="h-5 w-5 animate-spin text-[var(--workspace-shell-text-muted)]" />
        ) : error ? (
          <p className="text-sm text-[var(--workspace-shell-text-muted)]">
            {error}
          </p>
        ) : url && isImage ? (
          // eslint-disable-next-line @next/next/no-img-element -- signed storage URL
          <img
            src={url}
            alt={title}
            className={cn('w-full rounded-lg object-contain', imageMaxClass)}
          />
        ) : url && isPdf ? (
          <iframe
            title={`${title} preview`}
            src={`${url}#view=FitH`}
            className={cn(
              'w-full rounded-lg bg-[var(--workspace-shell-panel)]',
              frameHeightClass,
            )}
          />
        ) : null}
      </div>
    </div>
  );
}
