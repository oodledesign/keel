import Link from 'next/link';
import { notFound } from 'next/navigation';

import pathsConfig from '~/config/paths.config';
import { requireUserInServerComponent } from '~/lib/server/require-user-in-server-component';

import { loadRanklyProjectForTeam } from '../../../../../_lib/server/rankly-account-data';
import { loadClusterJobsForProject } from '../../../../../_lib/server/rankly-cluster-data';
import { loadTeamWorkspace } from '../../../../../_lib/server/team-account-workspace.loader';
import { redirectIfSpaceNotIn } from '../../../../../_lib/server/workspace-route-guard';
import { ClusterForm } from '../../../../_components/clusters/cluster-form';
import { RanklyProjectSectionHeader } from '../../../../_components/rankly-project-section-header';

type RanklyProjectClustersPageProps = {
  params: Promise<{
    account: string;
    projectId: string;
  }>;
};

function clustersBasePath(account: string, projectId: string) {
  return pathsConfig.app.accountRanklyProjectClusters
    .replace('[account]', account)
    .replace('[projectId]', projectId);
}

function clusterJobPath(account: string, projectId: string, jobId: string) {
  return pathsConfig.app.accountRanklyClusterJob
    .replace('[account]', account)
    .replace('[projectId]', projectId)
    .replace('[jobId]', jobId);
}

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pending',
  expanding: 'Expanding',
  awaiting_confirmation: 'Awaiting confirmation',
  fetching_serps: 'Fetching SERPs',
  clustering: 'Clustering',
  saving: 'Saving',
  done: 'Done',
  error: 'Error',
};

export default async function RanklyProjectClustersPage({
  params,
}: RanklyProjectClustersPageProps) {
  const { account, projectId } = await params;
  const workspace = await loadTeamWorkspace(account);
  redirectIfSpaceNotIn(workspace, account, ['work']);

  const user = await requireUserInServerComponent();
  const accountId = workspace.account.id as string;
  const project = await loadRanklyProjectForTeam(projectId, accountId);
  if (!project) {
    notFound();
  }

  const jobs = await loadClusterJobsForProject(projectId, user.id);
  const clustersPath = clustersBasePath(account, projectId);

  return (
    <div className="space-y-8">
      <RanklyProjectSectionHeader
        title="Keyword clusters"
        description="Expand seed keywords into a pillar + spokes content plan using SERP overlap clustering."
      />

      <section className="space-y-4">
        <h2 className="text-lg font-semibold">New cluster plan</h2>
        <ClusterForm
          accountId={accountId}
          projectId={projectId}
          clustersPath={clustersPath}
        />
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Previous plans</h2>
        {jobs.length === 0 ? (
          <p className="rounded-lg border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] px-4 py-6 text-sm text-[var(--workspace-shell-text-muted)]">
            No cluster plans yet. Enter seed keywords above to generate a pillar
            + spokes architecture.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-[color:var(--workspace-shell-border)]">
            <table className="w-full min-w-[36rem] text-left text-sm">
              <thead className="border-b border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] text-xs tracking-wide text-[var(--workspace-shell-text-muted)] uppercase">
                <tr>
                  <th className="px-4 py-3">Seeds</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Country</th>
                  <th className="px-4 py-3">Created</th>
                  <th className="px-4 py-3 text-right"> </th>
                </tr>
              </thead>
              <tbody>
                {jobs.map((job) => (
                  <tr
                    key={job.id}
                    className="border-b border-[color:var(--workspace-shell-border)] last:border-0"
                  >
                    <td className="max-w-xs truncate px-4 py-3">
                      {job.seeds.join(', ')}
                    </td>
                    <td className="px-4 py-3 text-[var(--workspace-shell-text-muted)]">
                      {STATUS_LABELS[job.status] ?? job.status}
                    </td>
                    <td className="px-4 py-3 text-[var(--workspace-shell-text-muted)] uppercase">
                      {job.country}
                    </td>
                    <td className="px-4 py-3 text-[var(--workspace-shell-text-muted)]">
                      {new Date(job.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={clusterJobPath(account, projectId, job.id)}
                        className="text-primary underline-offset-4 hover:underline"
                      >
                        View
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
