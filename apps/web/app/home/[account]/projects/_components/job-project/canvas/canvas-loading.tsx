import { Loader2 } from 'lucide-react';

/** Placeholder shown while the project canvas code and data load. */
export function CanvasLoading() {
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex h-[calc(100vh-15rem)] min-h-[560px] flex-col items-center justify-center gap-3 rounded-xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-control-surface)]/40 text-sm text-[var(--workspace-shell-text-muted)]"
    >
      <Loader2 className="h-6 w-6 animate-spin" aria-hidden />
      <span>Loading canvas…</span>
    </div>
  );
}
