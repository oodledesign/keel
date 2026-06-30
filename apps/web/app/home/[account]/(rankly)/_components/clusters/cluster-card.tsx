'use client';

import Link from 'next/link';

import { Button } from '@kit/ui/button';

type Spoke = {
  id: string;
  title: string;
  target_keyword: string;
  volume: number | null;
  h1: string | null;
  h2s: string[] | null;
  position: number | null;
};

type Cluster = {
  id: string;
  name: string;
  role: string;
  primary_keyword: string;
  secondary_keywords: string[] | null;
  total_volume: number | null;
  weighted_kd: number | null;
  priority_score: number | null;
  intent: string | null;
  pillar_h1: string | null;
  pillar_h2s: string[] | null;
  build_order: number | null;
  spokes: Spoke[];
};

export function ClusterCard({
  cluster,
  briefNewPath,
  country,
}: {
  cluster: Cluster;
  briefNewPath?: string;
  country?: string;
}) {
  return (
    <article className="rounded-lg border border-[color:var(--workspace-shell-border)] bg-black/10 p-5 space-y-4">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            Build order #{cluster.build_order ?? '—'} · {cluster.role}
          </p>
          <h3 className="mt-1 text-lg font-semibold">{cluster.name}</h3>
          <p className="text-sm text-muted-foreground">
            Primary: {cluster.primary_keyword}
          </p>
        </div>
        <dl className="grid grid-cols-3 gap-3 text-right text-xs">
          <div>
            <dt className="text-muted-foreground">Volume</dt>
            <dd className="font-medium">{cluster.total_volume ?? '—'}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">KD</dt>
            <dd className="font-medium">{cluster.weighted_kd ?? '—'}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Priority</dt>
            <dd className="font-medium">
              {cluster.priority_score != null
                ? Number(cluster.priority_score).toFixed(2)
                : '—'}
            </dd>
          </div>
        </dl>
      </header>

      {cluster.pillar_h1 ? (
        <div className="rounded-md border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] px-4 py-3 text-sm">
          <p className="font-medium">{cluster.pillar_h1}</p>
          {cluster.pillar_h2s?.length ? (
            <ul className="mt-2 list-inside list-disc text-muted-foreground">
              {cluster.pillar_h2s.map((h2) => (
                <li key={h2}>{h2}</li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      {cluster.secondary_keywords?.length ? (
        <p className="text-xs text-muted-foreground">
          Secondary: {cluster.secondary_keywords.join(', ')}
        </p>
      ) : null}

      {cluster.spokes.length > 0 ? (
        <div className="space-y-3">
          <h4 className="text-sm font-medium">Spoke articles</h4>
          <ul className="space-y-2">
            {cluster.spokes.map((spoke) => (
              <li
                key={spoke.id}
                className="rounded-md border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] px-4 py-3 text-sm"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-medium">{spoke.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {spoke.target_keyword}
                      {spoke.volume != null ? ` · vol ${spoke.volume}` : ''}
                    </p>
                  </div>
                  {briefNewPath ? (
                    <Button size="sm" variant="outline" asChild>
                      <Link
                        href={`${briefNewPath}?keyword=${encodeURIComponent(spoke.target_keyword)}&country=${encodeURIComponent(country ?? 'gb')}&spokeId=${spoke.id}`}
                      >
                        Generate brief
                      </Link>
                    </Button>
                  ) : null}
                </div>
                {spoke.h1 ? (
                  <p className="mt-1 text-muted-foreground">H1: {spoke.h1}</p>
                ) : null}
                {spoke.h2s?.length ? (
                  <ul className="mt-1 list-inside list-disc text-xs text-muted-foreground">
                    {spoke.h2s.map((h2) => (
                      <li key={h2}>{h2}</li>
                    ))}
                  </ul>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </article>
  );
}
