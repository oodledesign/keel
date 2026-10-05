import { AlertTriangle, Loader2 } from 'lucide-react';

import { Progress } from '@kit/ui/progress';

import { formatSecondsLeft } from '~/lib/videos/eta';

/**
 * Stand-in for a video that has no playable stream or thumbnail yet. Sized
 * with container units so the text always fits, from list thumbnails up to
 * the full preview pane.
 */
export function VideoProcessingState(props: {
  /** 'uploading' = still arriving at Bunny; 'processing' = being encoded. */
  status: 'uploading' | 'processing';
  /** Encode progress 0-100, when known. */
  percent?: number | null;
  secondsLeft?: number | null;
  /** The file never finished uploading; nothing is being encoded. */
  stalled?: boolean;
  /** Hide the secondary line (tiny list thumbnails). */
  compact?: boolean;
}) {
  const label = props.stalled
    ? 'Upload didn’t finish'
    : props.status === 'uploading'
      ? 'Uploading'
      : 'Processing';
  const percent =
    props.percent != null && props.percent > 0
      ? Math.min(100, Math.round(props.percent))
      : null;
  const eta = formatSecondsLeft(props.secondsLeft ?? null);

  return (
    <div
      className="@container absolute inset-0"
      role="status"
      aria-live="polite"
    >
      <div className="flex h-full w-full flex-col items-center justify-center gap-[3cqw] bg-[var(--workspace-shell-sidebar-accent)] px-[6cqw] text-center">
        {props.stalled ? (
          <AlertTriangle className="size-[clamp(1rem,10cqw,2rem)] text-amber-500" />
        ) : (
          <Loader2 className="size-[clamp(1rem,10cqw,2rem)] animate-spin text-[var(--ozer-accent)]" />
        )}
        <p className="text-[clamp(0.65rem,5cqw,0.95rem)] leading-none font-medium">
          {label}
          {props.stalled
            ? ''
            : percent != null && !props.compact
              ? ` · ${percent}%`
              : '…'}
        </p>
        {!props.compact ? (
          <>
            {percent != null && !props.stalled ? (
              <Progress
                value={percent}
                className="h-1 w-3/5 max-w-40 bg-black/20 [&>div]:bg-[var(--ozer-accent)]"
              />
            ) : null}
            <p className="text-muted-foreground text-[clamp(0.6rem,3.6cqw,0.75rem)] leading-tight">
              {props.stalled
                ? 'Delete it and upload again'
                : (eta ??
                  (props.status === 'processing'
                    ? 'Usually a few minutes'
                    : 'Finishing upload'))}
            </p>
          </>
        ) : null}
      </div>
    </div>
  );
}
