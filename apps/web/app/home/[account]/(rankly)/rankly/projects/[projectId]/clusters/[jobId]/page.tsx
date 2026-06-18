import Link from 'next/link';
import { notFound } from 'next/navigation';

import pathsConfig from '~/config/paths.config';

import { ClusterJobPoller } from '../../../../../_components/clusters/cluster-job-poller';
import { ClusterPlanView } from '../../../../../_components/clusters/cluster-plan-view';
import { RanklyProjectSectionHeader } from '../../../../../_components/rankly-project-section-header';
import { loadClusterJobBundleForUser } from '../../../../../../_lib/server/rankly-cluster-data';
import { loadRanklyProjectForTeam } from '../../../../../../_lib/server/rankly-account-data';
import { loadTeamWorkspace } from '../../../../../../_lib/server/team-account-workspace.loader';
import { redirectIfSpaceNotIn } from '../../../../../../_lib/server/workspace-route-guard';
import { requireUserInServerComponent } from '~/lib/server/require-user-in-server-component';

type RanklyClusterJobPageProps = {
  params: Promise<{
    account: string;
    projectId: string;
    jobId: string;
  }>;
};

function clustersPath(account: string, projectId: string) {
  return pathsConfig.app.accountRanklyProjectClusters
    .replace('[account]', account)
    .replace('[projectId]', projectId);
}

export default async function RanklyClusterJobPage({
  params,
}: RanklyClusterJobPageProps) {
  const { account, projectId, jobId } = await params;
  const workspace = await loadTeamWorkspace(account);
  redirectIfSpaceNotIn(workspace, account, ['work']);

  const user = await requireUserInServerComponent();
  const accountId = workspace.account.id as string;
  const project = await loadRanklyProjectForTeam(projectId, accountId);
  if (!project) {
    notFound();
  }

  const bundle = await loadClusterJobBundleForUser(jobId, user.id);
  if (!bundle || bundle.job.project_id !== projectId) {
    notFound();
  }

  const { job, clusters, qualityGates, links, clusterNameById } = bundle;
  const isDone = job.status === 'done';
  const briefNewPath = `${pathsConfig.app.accountRanklyProjectBriefs
    .replace('[account]', account)
    .replace('[projectId]', projectId)}/new`;
  const briefsPath = pathsConfig.app.accountRanklyProjectBriefs
    .replace('[account]', account)
    .replace('[projectId]', projectId);

  return (
    <div className="space-y-8">
      <RanklyProjectSectionHeader
        title={isDone ? 'Cluster plan' : 'Building cluster plan'}
        description={`${job.seeds.length} seed keywords`}
      />

      {!isDone ? (
        <ClusterJobPoller jobId={jobId} />
      ) : (
        <ClusterPlanView
          job={job}
          clusters={clusters}
          qualityGates={qualityGates}
          links={links}
          clusterNameById={clusterNameById}
          briefNewPath={briefNewPath}
          accountId={accountId}
          projectId={projectId}
          briefsPath={briefsPath}
        />
      )}

      <Link
        href={clustersPath(account, projectId)}
        className="inline-block text-sm text-primary underline-offset-4 hover:underline"
      >
        ← Back to cluster plans
      </Link>
    </div>
  );
}
