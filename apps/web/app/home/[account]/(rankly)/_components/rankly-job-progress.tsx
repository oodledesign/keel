'use client';

type RanklyJobProgressProps = {
  label: string;
  percent: number;
  detail?: string | null;
  meta?: string | null;
};

export function RanklyJobProgress({
  label,
  percent,
  detail,
  meta,
}: RanklyJobProgressProps) {
  return (
    <div className="max-w-xl space-y-3">
      {detail ? (
        <p className="text-sm text-[var(--workspace-shell-text-muted)]">
          {detail}
        </p>
      ) : null}
      {meta ? (
        <p className="text-sm text-[var(--workspace-shell-text-muted)]">
          {meta}
        </p>
      ) : null}
      <div className="flex items-center justify-between text-sm">
        <span className="text-[var(--workspace-shell-text-muted)]">
          {label}
        </span>
        <span className="text-[var(--workspace-shell-text-muted)]">
          {percent}%
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-[var(--workspace-control-surface)]">
        <div
          className="bg-primary h-full rounded-full transition-all duration-500"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}
