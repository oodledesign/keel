import Link from 'next/link';

import { PageBody } from '@kit/ui/page';

import { TeamAccountLayoutPageHeader } from '../../_components/team-account-layout-page-header';
import {
  ModuleDataSection,
  ModuleEmptyState,
} from '../../_components/module-data-section';
import { loadFeedflowVideosForTeam } from '../../_lib/server/feedflow-account-data';
import { loadTeamWorkspace } from '../../_lib/server/team-account-workspace.loader';
import { redirectIfSpaceNotIn } from '../../_lib/server/workspace-route-guard';
import { workAccountPath, workPaths } from '../../_lib/work-account-path';

type FeedflowVideosPageProps = {
  params: Promise<{
    account: string;
  }>;
};

export default async function FeedflowVideosPage({
  params,
}: FeedflowVideosPageProps) {
  const { account } = await params;
  const workspace = await loadTeamWorkspace(account);
  redirectIfSpaceNotIn(workspace, account, ['work']);

  const videos = await loadFeedflowVideosForTeam(workspace.account.id as string);

  return (
    <>
      <TeamAccountLayoutPageHeader
        account={account}
        title="Feedflow videos"
        description="Hosted or processed videos tied to this workspace."
      />
      <PageBody className="space-y-8 bg-[var(--workspace-shell-canvas)] px-4 py-8 text-[var(--workspace-shell-text)] lg:px-6">
        <ModuleDataSection title="Videos">
          {videos.length === 0 ? (
            <ModuleEmptyState message="No videos yet. Entries appear here when feedflow.videos has rows for this account." />
          ) : (
            <div className="overflow-x-auto rounded-lg border border-white/10">
              <table className="w-full min-w-[28rem] text-left text-sm">
                <thead className="border-b border-white/10 bg-black/20 text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3">Title</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Embed key</th>
                    <th className="px-4 py-3">Created</th>
                  </tr>
                </thead>
                <tbody>
                  {videos.map((v) => (
                    <tr
                      key={v.id}
                      className="border-b border-white/5 last:border-0"
                    >
                      <td className="px-4 py-3">{v.title ?? 'Untitled'}</td>
                      <td className="px-4 py-3 capitalize text-muted-foreground">
                        {v.status}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs">
                        {v.embed_key ?? '—'}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {new Date(v.created_at).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </ModuleDataSection>

        <div className="flex flex-wrap gap-3 text-sm">
          <Link
            href={workAccountPath(workPaths.accountFeedflowWidgets, account)}
            className="rounded-lg border border-white/10 bg-black/10 px-4 py-2 transition hover:border-white/20"
          >
            Widgets
          </Link>
          <Link
            href={workAccountPath(workPaths.accountFeedflowReviews, account)}
            className="rounded-lg border border-white/10 bg-black/10 px-4 py-2 transition hover:border-white/20"
          >
            Reviews overview
          </Link>
        </div>
      </PageBody>
    </>
  );
}
