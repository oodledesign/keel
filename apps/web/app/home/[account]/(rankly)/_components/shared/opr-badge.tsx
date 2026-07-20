'use client';

type OprBadgeProps = {
  score: number;
  decimal?: number;
  showLabel?: boolean;
};

export function OprBadge({ score, decimal, showLabel = true }: OprBadgeProps) {
  const colour =
    score >= 7
      ? 'border-[var(--ozer-accent)]/30 bg-[var(--ozer-accent-subtle)] text-[var(--workspace-shell-accent-text)]'
      : score >= 4
        ? 'border-[color-mix(in_srgb,#F0C14B_35%,transparent)] bg-[color-mix(in_srgb,#F0C14B_12%,transparent)] text-[var(--workspace-shell-text)]'
        : 'border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] text-[var(--workspace-shell-text-muted)]';

  return (
    <span
      className={`inline-flex items-center gap-1 rounded border px-2 py-0.5 text-xs font-medium tabular-nums ${colour}`}
      title={decimal != null ? `Open PageRank: ${decimal}` : undefined}
    >
      {showLabel ? <span className="opacity-60">OPR</span> : null}
      {score}/10
    </span>
  );
}
