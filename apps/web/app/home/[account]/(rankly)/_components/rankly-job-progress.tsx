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
        <p className="text-sm text-muted-foreground">{detail}</p>
      ) : null}
      {meta ? (
        <p className="text-sm text-muted-foreground">{meta}</p>
      ) : null}
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className="text-muted-foreground">{percent}%</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-black/30">
        <div
          className="h-full rounded-full bg-primary transition-all duration-500"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}
