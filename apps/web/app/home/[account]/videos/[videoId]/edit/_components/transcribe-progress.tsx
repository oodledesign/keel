'use client';

import { useEffect, useState } from 'react';

import { Loader2 } from 'lucide-react';

import { Progress } from '@kit/ui/progress';

function formatElapsed(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;
}

function describeEstimate(ms: number) {
  const s = Math.round(ms / 1000);
  if (s < 45) return 'usually under a minute';
  const minutes = Math.max(1, Math.round(s / 60));
  return `usually about ${minutes} min`;
}

/**
 * Whisper reports no progress, so the bar is an estimate from the source
 * length. It eases toward 95% and only completes when the request returns.
 */
export function TranscribeProgress(props: {
  startedAt: number;
  sourceDurationMs: number;
}) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(id);
  }, []);

  const elapsedMs = Math.max(0, now - props.startedAt);
  const expectedMs = 10_000 + props.sourceDurationMs * 0.1;
  const percent = 95 * (1 - Math.exp(-elapsedMs / expectedMs));
  const overdue = elapsedMs > expectedMs * 2;

  return (
    <div
      className="mt-3 rounded-md border border-[color:var(--workspace-shell-border)] bg-[var(--ozer-surface-panel-hover)] p-3"
      role="status"
      aria-live="polite"
    >
      <div className="flex items-center gap-2 text-sm font-medium text-[var(--workspace-shell-text)]">
        <Loader2 className="h-4 w-4 animate-spin text-[var(--ozer-accent)]" />
        Transcribing with Whisper…
      </div>
      <Progress
        value={percent}
        className="mt-2 h-1 bg-[var(--workspace-shell-border)] [&>div]:bg-[var(--ozer-accent)]"
      />
      <p className="mt-2 text-xs text-[var(--workspace-shell-text-muted)]">
        {formatElapsed(elapsedMs)} elapsed ·{' '}
        {overdue
          ? 'taking longer than usual, still working'
          : describeEstimate(expectedMs)}
        . Keep this page open.
      </p>
    </div>
  );
}
