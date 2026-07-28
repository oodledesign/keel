'use client';

type AhrefsDrBadgeProps = {
  score: number | null | undefined;
  showLabel?: boolean;
};

export function AhrefsDrBadge({ score, showLabel = true }: AhrefsDrBadgeProps) {
  if (score == null || Number.isNaN(Number(score))) return null;

  const value = Math.round(Number(score));
  const colour =
    value >= 70
      ? 'border-[var(--ozer-accent)]/30 bg-[var(--ozer-accent-subtle)] text-[var(--workspace-shell-accent-text)]'
      : value >= 40
        ? 'border-[color-mix(in_srgb,#F0C14B_35%,transparent)] bg-[color-mix(in_srgb,#F0C14B_12%,transparent)] text-[var(--workspace-shell-text)]'
        : 'border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] text-[var(--workspace-shell-text-muted)]';

  return (
    <span
      className={`inline-flex items-center gap-1 rounded border px-2 py-0.5 text-xs font-medium tabular-nums ${colour}`}
      title="Domain Rating by Ahrefs (0–100)"
    >
      {showLabel ? <span className="opacity-60">DR</span> : null}
      {value}
    </span>
  );
}

export function AhrefsDrAttribution({ className }: { className?: string }) {
  return (
    <a
      href="https://ahrefs.com/"
      target="_blank"
      rel="noopener noreferrer"
      className={
        className ??
        'text-xs text-[var(--workspace-shell-text-muted)] underline-offset-2 hover:underline'
      }
    >
      Domain Rating by Ahrefs
    </a>
  );
}
