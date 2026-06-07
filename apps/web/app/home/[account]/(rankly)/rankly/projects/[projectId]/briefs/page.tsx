import Link from 'next/link';
import { notFound } from 'next/navigation';

import pathsConfig from '~/config/paths.config';

import { BriefForm } from '../../../../_components/briefs/brief-form';
import { RanklyProjectSectionHeader } from '../../../../_components/rankly-project-section-header';
import { loadRanklyProjectForTeam } from '../../../../../_lib/server/rankly-account-data';
import { loadTeamWorkspace } from '../../../../../_lib/server/team-account-workspace.loader';
import { redirectIfSpaceNotIn } from '../../../../../_lib/server/workspace-route-guard';
import { requireUserInServerComponent } from '~/lib/server/require-user-in-server-component';
import { listBriefsForProject } from '~/lib/briefs/db';

type RanklyBriefsPageProps = {
  params: Promise<{ account: string; projectId: string }>;
};

function briefsPath(account: string, projectId: string) {
  return pathsConfig.app.accountRanklyProjectBriefs
    .replace('[account]', account)
    .replace('[projectId]', projectId);
}

export default async function RanklyProjectBriefsPage({
  params,
}: RanklyBriefsPageProps) {
  const { account, projectId } = await params;
  const workspace = await loadTeamWorkspace(account);
  redirectIfSpaceNotIn(workspace, account, ['work']);

  const user = await requireUserInServerComponent();
  const accountId = workspace.account.id as string;
  const project = await loadRanklyProjectForTeam(projectId, accountId);
  if (!project) notFound();

  const briefs = await listBriefsForProject(projectId, user.id);
  const base = briefsPath(account, projectId);

  return (
    <div className="space-y-8">
      <RanklyProjectSectionHeader
        title="Content briefs"
        description="Writer-ready SEO briefs with SERP teardown, template classification, and internal linking."
      />

      <section className="space-y-4">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-lg font-semibold">New brief</h2>
          <Link
            href={`${base}/new`}
            className="text-sm text-primary underline-offset-4 hover:underline"
          >
            Open full form →
          </Link>
        </div>
        <BriefForm
          accountId={accountId}
          projectId={projectId}
          projectDomain={project.domain}
          briefsPath={base}
        />
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Saved briefs</h2>
        {briefs.length === 0 ? (
          <p className="text-muted-foreground rounded-lg border border-white/10 bg-black/10 px-4 py-6 text-sm">
            No briefs yet. Generate one from a keyword or cluster spoke.
          </p>
        ) : (
          <ul className="divide-y divide-white/10 rounded-lg border border-white/10">
            {briefs.map((brief) => (
              <li key={brief.id} className="flex items-center justify-between px-4 py-3 text-sm">
                <div>
                  <p className="font-medium">{brief.target_keyword}</p>
                  <p className="text-xs text-muted-foreground capitalize">
                    {brief.template_type?.replace(/-/g, ' ') ?? 'brief'} ·{' '}
                    {new Date(brief.created_at).toLocaleDateString()}
                  </p>
                </div>
                <Link
                  href={`${base}/${brief.id}`}
                  className="text-primary underline-offset-4 hover:underline"
                >
                  View
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
