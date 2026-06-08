import Link from 'next/link';

import { PageBody } from '@kit/ui/page';

import { TeamAccountLayoutPageHeader } from '../../_components/team-account-layout-page-header';
import {
  ModuleDataSection,
  ModuleEmptyState,
} from '../../_components/module-data-section';
import { FeedflowOauthBanner } from '../_components/feedflow-oauth-banner';
import {
  loadFeedflowSocialAccountsForTeam,
  loadFeedflowWidgetsForTeam,
} from '../../_lib/server/feedflow-account-data';
import { loadTeamWorkspace } from '../../_lib/server/team-account-workspace.loader';
import { redirectIfSpaceNotIn } from '../../_lib/server/workspace-route-guard';
import { workAccountPath, workPaths } from '../../_lib/work-account-path';

type FeedflowReviewsPageProps = {
  params: Promise<{
    account: string;
  }>;
  searchParams: Promise<{
    feedflow_error?: string;
    feedflow_connected?: string;
  }>;
};

export default async function FeedflowReviewsPage({
  params,
  searchParams,
}: FeedflowReviewsPageProps) {
  const { account } = await params;
  const sp = await searchParams;
  const workspace = await loadTeamWorkspace(account);
  redirectIfSpaceNotIn(workspace, account, ['work']);

  const accountId = workspace.account.id;
  let oauthError: string | null = null;
  if (sp.feedflow_error) {
    try {
      oauthError = decodeURIComponent(sp.feedflow_error);
    } catch {
      oauthError = sp.feedflow_error;
    }
  }
  const [social, widgets] = await Promise.all([
    loadFeedflowSocialAccountsForTeam(accountId),
    loadFeedflowWidgetsForTeam(accountId),
  ]);

  return (
    <>
      <TeamAccountLayoutPageHeader
        account={account}
        title="Feedflow reviews"
        description="Connected social sources and embeddable widgets for this workspace."
      />
      <PageBody className="space-y-10 bg-[var(--workspace-shell-canvas)] px-0 py-8 text-[var(--workspace-shell-text)] lg:px-6">
        <FeedflowOauthBanner
          error={oauthError}
          success={sp.feedflow_connected ?? null}
        />

        <ModuleDataSection
          title="Social accounts"
          description="Sources used to pull posts and reviews into widgets."
        >
          {social.length === 0 ? (
            <ModuleEmptyState message="No social accounts yet. Connect one under Social accounts in the sidebar." />
          ) : (
            <div className="overflow-x-auto rounded-lg border border-white/10">
              <table className="w-full min-w-[32rem] text-left text-sm">
                <thead className="border-b border-white/10 bg-black/20 text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3">Platform</th>
                    <th className="px-4 py-3">External id</th>
                    <th className="px-4 py-3">Client</th>
                    <th className="px-4 py-3">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {social.map((row) => (
                    <tr
                      key={row.id}
                      className="border-b border-white/5 last:border-0"
                    >
                      <td className="px-4 py-3">
                        {row.platform ?? row.provider}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs">
                        {row.external_account_id}
                      </td>
                      <td className="px-4 py-3">
                        {row.client_id ? (
                          <Link
                            href={`${workAccountPath(workPaths.accountFeedflowReviews, account)}/${row.client_id}`}
                            className="text-primary underline-offset-4 hover:underline"
                          >
                            View client feed
                          </Link>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {row.token_status ?? '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </ModuleDataSection>

        <ModuleDataSection
          title="Widgets"
          description="Public JSON for each widget is served from the feed API using the embed key."
        >
          {widgets.length === 0 ? (
            <ModuleEmptyState message="No widgets yet. Create one under Feedflow Widgets." />
          ) : (
            <div className="overflow-x-auto rounded-lg border border-white/10">
              <table className="w-full min-w-[36rem] text-left text-sm">
                <thead className="border-b border-white/10 bg-black/20 text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3">Name</th>
                    <th className="px-4 py-3">Layout</th>
                    <th className="px-4 py-3">Embed key</th>
                    <th className="px-4 py-3">Feed</th>
                  </tr>
                </thead>
                <tbody>
                  {widgets.map((w) => (
                    <tr
                      key={w.id}
                      className="border-b border-white/5 last:border-0"
                    >
                      <td className="px-4 py-3">{w.name}</td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {w.layout ?? 'grid'} · {w.post_count ?? 9} posts
                      </td>
                      <td className="px-4 py-3 font-mono text-xs">{w.embed_key}</td>
                      <td className="px-4 py-3">
                        <a
                          href={`/api/feedflow/feed?widget=${encodeURIComponent(w.embed_key)}`}
                          className="text-primary underline-offset-4 hover:underline"
                          target="_blank"
                          rel="noreferrer"
                        >
                          Open JSON
                        </a>
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
            href={workAccountPath(workPaths.accountFeedflowSocialAccounts, account)}
            className="rounded-lg border border-white/10 bg-black/10 px-4 py-2 transition hover:border-white/20"
          >
            Manage social connections
          </Link>
          <Link
            href={workAccountPath(workPaths.accountFeedflowWidgets, account)}
            className="rounded-lg border border-white/10 bg-black/10 px-4 py-2 transition hover:border-white/20"
          >
            Manage widgets
          </Link>
          <Link
            href={workAccountPath(workPaths.accountFeedflowVideos, account)}
            className="rounded-lg border border-white/10 bg-black/10 px-4 py-2 transition hover:border-white/20"
          >
            Video library
          </Link>
        </div>
      </PageBody>
    </>
  );
}
