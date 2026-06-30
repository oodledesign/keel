'use client';

type BacklinkBarProps = {
  domain: string;
  referringDomains: number | null;
  maxCount: number;
};

export function BacklinkSourceNote() {
  return (
    <p
      className="text-xs text-muted-foreground"
      title="Backlink data sourced from Common Crawl (monthly snapshot). For real-time data, upgrade to our Pro plan."
    >
      Backlinks sourced from Common Crawl (monthly snapshot).
    </p>
  );
}

export function BacklinkBar({
  domain,
  referringDomains,
  maxCount,
}: BacklinkBarProps) {
  if (referringDomains === null) {
    return (
      <span
        className="text-xs text-muted-foreground"
        title={`${domain} — not found in Common Crawl index`}
      >
        Not in crawl
      </span>
    );
  }

  const pct =
    maxCount > 0 ? Math.round((referringDomains / maxCount) * 100) : 0;

  return (
    <div
      className="flex min-w-[140px] items-center gap-2"
      title={`${referringDomains.toLocaleString()} referring domains`}
    >
      <div className="h-1.5 flex-1 rounded-full bg-[var(--workspace-shell-sidebar-accent)]">
        <div
          className="h-1.5 rounded-full bg-sky-500/80"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="w-16 text-right text-xs tabular-nums text-muted-foreground">
        {referringDomains.toLocaleString()} RDs
      </span>
    </div>
  );
}
