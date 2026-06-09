'use client';

type OprBadgeProps = {
  score: number;
  decimal?: number;
  showLabel?: boolean;
};

export function OprBadge({
  score,
  decimal,
  showLabel = true,
}: OprBadgeProps) {
  const colour =
    score >= 7
      ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200'
      : score >= 4
        ? 'border-amber-500/40 bg-amber-500/10 text-amber-200'
        : 'border-white/10 bg-white/5 text-muted-foreground';

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
