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
        <p className="text-muted-foreground text-sm">{detail}</p>
      ) : null}
      {meta ? <p className="text-muted-foreground text-sm">{meta}</p> : null}
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className="text-muted-foreground">{percent}%</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-black/30">
        <div
          className="bg-primary h-full rounded-full transition-all duration-500"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}
