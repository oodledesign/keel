'use client';

import { useEffect } from 'react';

import { useRouter } from 'next/navigation';

import { AlertTriangle, Loader2 } from 'lucide-react';

import { Button } from '@kit/ui/button';

import type { MeetingPostSyncNotice } from '~/lib/recorder/meeting-post-sync-status';

type Props = {
  notice: MeetingPostSyncNotice;
  canRetry?: boolean;
  pending?: boolean;
  onRetry?: () => void;
  variant?: 'workspace' | 'public';
};

export function MeetingPostSyncNoticeBanner({
  notice,
  canRetry = false,
  pending = false,
  onRetry,
  variant = 'workspace',
}: Props) {
  const router = useRouter();
  const inProgress = notice.tone === 'progress';

  useEffect(() => {
    if (!inProgress) return;
    const timer = window.setInterval(() => {
      router.refresh();
    }, 4000);
    return () => window.clearInterval(timer);
  }, [inProgress, router]);

  const workspace = variant === 'workspace';
  const className = workspace
    ? 'flex items-start gap-3 rounded-xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] px-4 py-3 text-sm text-[var(--workspace-shell-text)]'
    : 'flex items-start gap-3 rounded-xl border border-[color:var(--ozer-border-on-light)] bg-[var(--ozer-cream-50)] px-4 py-3 text-sm text-[var(--ozer-text-on-light)]';
  const muted = workspace
    ? 'text-[var(--workspace-shell-text-muted)]'
    : 'text-[var(--ozer-text-on-light-muted)]';

  return (
    <div
      role="status"
      data-test="meeting-post-sync-notice"
      data-tone={notice.tone}
      className={className}
    >
      {inProgress ? (
        <Loader2 className="mt-0.5 h-4 w-4 shrink-0 animate-spin text-[var(--ozer-accent)]" />
      ) : (
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[var(--ozer-accent)]" />
      )}
      <div className="min-w-0 flex-1 space-y-2">
        <p>{notice.message}</p>
        {notice.detail ? (
          <p className={`text-xs ${muted}`}>{notice.detail}</p>
        ) : null}
        {!inProgress && canRetry && onRetry ? (
          <Button
            type="button"
            size="sm"
            disabled={pending}
            data-test="meeting-post-sync-retry"
            className="bg-[var(--ozer-accent)] text-[var(--ozer-white)] hover:bg-[var(--ozer-accent-hover)]"
            onClick={onRetry}
          >
            {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Try again
          </Button>
        ) : null}
      </div>
    </div>
  );
}
