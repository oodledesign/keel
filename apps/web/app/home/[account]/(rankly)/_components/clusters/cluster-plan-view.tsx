'use client';

import Link from 'next/link';

import { Button } from '@kit/ui/button';

import { BatchClusterBriefsButton } from './batch-cluster-briefs-button';
import { ClusterCard } from './cluster-card';
import { QualityScorecard } from './quality-scorecard';

type ClusterJob = {
  id: string;
  seeds: string[];
  country: string;
  credits_used: number | null;
  candidate_count: number | null;
  created_at: string;
};

type ClusterLink = {
  id: string;
  from_cluster_id: string | null;
  to_cluster_id: string | null;
  link_type: string | null;
};

type ClusterPlanViewProps = {
  job: ClusterJob;
  clusters: Parameters<typeof ClusterCard>[0]['cluster'][];
  qualityGates: Parameters<typeof QualityScorecard>[0]['gates'];
  links: ClusterLink[];
  clusterNameById: Record<string, string>;
  briefNewPath?: string;
  accountId?: string;
  projectId?: string;
  briefsPath?: string;
};

export function ClusterPlanView({
  job,
  clusters,
  qualityGates,
  links,
  clusterNameById,
  briefNewPath,
  accountId,
  projectId,
  briefsPath,
}: ClusterPlanViewProps) {
  const sorted = [...clusters].sort(
    (a, b) => (a.build_order ?? 0) - (b.build_order ?? 0),
  );
  const spokeCount = sorted.reduce(
    (total, cluster) => total + cluster.spokes.length,
    0,
  );

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <h2 className="text-xl font-semibold">Cluster plan</h2>
        <p className="text-sm text-muted-foreground">
          {job.seeds.length} seeds · {job.country.toUpperCase()} ·{' '}
          {job.candidate_count ?? '—'} keywords · ~
          {job.credits_used ?? '—'} credits
        </p>
      </header>

      <QualityScorecard gates={qualityGates} />

      {accountId && projectId && briefsPath && spokeCount > 0 ? (
        <BatchClusterBriefsButton
          accountId={accountId}
          projectId={projectId}
          clusterJobId={job.id}
          country={job.country}
          spokeCount={spokeCount}
          briefsPath={briefsPath}
        />
      ) : null}

      <div className="space-y-6">
        {sorted.map((cluster) => (
          <ClusterCard
            key={cluster.id}
            cluster={cluster}
            briefNewPath={briefNewPath}
            country={job.country}
          />
        ))}
      </div>

      {links.length > 0 ? (
        <section className="space-y-3">
          <h3 className="text-sm font-medium">Internal linking</h3>
          <ul className="rounded-lg border border-[color:var(--workspace-shell-border)] divide-y divide-white/5 text-sm">
            {links.map((link) => (
              <li key={link.id} className="px-4 py-2 text-muted-foreground">
                {link.from_cluster_id
                  ? (clusterNameById[link.from_cluster_id] ?? link.from_cluster_id)
                  : '—'}{' '}
                →{' '}
                {link.to_cluster_id
                  ? (clusterNameById[link.to_cluster_id] ?? link.to_cluster_id)
                  : '—'}{' '}
                <span className="text-xs">({link.link_type})</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <Button variant="outline" asChild>
        <Link href={`/api/rankly/clusters/${job.id}/export`} download>
          Export CSV
        </Link>
      </Button>
    </div>
  );
}
