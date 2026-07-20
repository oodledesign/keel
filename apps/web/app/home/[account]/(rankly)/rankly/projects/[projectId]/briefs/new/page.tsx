import { Suspense } from 'react';

import Link from 'next/link';
import { notFound } from 'next/navigation';

import pathsConfig from '~/config/paths.config';
import { requireUserInServerComponent } from '~/lib/server/require-user-in-server-component';

import { loadRanklyProjectForTeam } from '../../../../../../_lib/server/rankly-account-data';
import { loadTeamWorkspace } from '../../../../../../_lib/server/team-account-workspace.loader';
import { redirectIfSpaceNotIn } from '../../../../../../_lib/server/workspace-route-guard';
import { BriefForm } from '../../../../../_components/briefs/brief-form';
import { BriefJobPoller } from '../../../../../_components/briefs/brief-job-poller';
import { RanklyProjectSectionHeader } from '../../../../../_components/rankly-project-section-header';

type RanklyNewBriefPageProps = {
  params: Promise<{ account: string; projectId: string }>;
  searchParams: Promise<{ jobId?: string }>;
};

function briefsPath(account: string, projectId: string) {
  return pathsConfig.app.accountRanklyProjectBriefs
    .replace('[account]', account)
    .replace('[projectId]', projectId);
}

export default async function RanklyNewBriefPage({
  params,
  searchParams,
}: RanklyNewBriefPageProps) {
  const { account, projectId } = await params;
  const { jobId } = await searchParams;
  const workspace = await loadTeamWorkspace(account);
  redirectIfSpaceNotIn(workspace, account, ['work']);

  await requireUserInServerComponent();
  const accountId = workspace.account.id as string;
  const project = await loadRanklyProjectForTeam(projectId, accountId);
  if (!project) notFound();

  const base = briefsPath(account, projectId);

  return (
    <div className="space-y-8">
      <RanklyProjectSectionHeader
        title={jobId ? 'Generating brief' : 'New content brief'}
        description={project.domain}
      />

      {jobId ? (
        <BriefJobPoller jobId={jobId} briefsPath={base} />
      ) : (
        <Suspense
          fallback={
            <p className="text-sm text-[var(--workspace-shell-text-muted)]">
              Loading…
            </p>
          }
        >
          <BriefForm
            accountId={accountId}
            projectId={projectId}
            projectDomain={project.domain}
            briefsPath={base}
          />
        </Suspense>
      )}

      <Link
        href={base}
        className="text-primary inline-block text-sm underline-offset-4 hover:underline"
      >
        ← Back to briefs
      </Link>
    </div>
  );
}
