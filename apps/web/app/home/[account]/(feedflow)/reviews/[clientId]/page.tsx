import Link from 'next/link';
import { notFound } from 'next/navigation';

import { PageBody } from '@kit/ui/page';

import { TeamAccountLayoutPageHeader } from '../../../_components/team-account-layout-page-header';
import {
  ModuleDataSection,
  ModuleEmptyState,
} from '../../../_components/module-data-section';
import {
  loadClientForTeam,
  loadFeedflowSocialAccountsForClient,
} from '../../../_lib/server/feedflow-account-data';
import { loadTeamWorkspace } from '../../../_lib/server/team-account-workspace.loader';
import { redirectIfSpaceNotIn } from '../../../_lib/server/workspace-route-guard';
import { workAccountPath, workPaths } from '../../../_lib/work-account-path';

type FeedflowClientReviewsPageProps = {
  params: Promise<{
    account: string;
    clientId: string;
  }>;
};

export default async function FeedflowClientReviewsPage({
  params,
}: FeedflowClientReviewsPageProps) {
  const { account, clientId } = await params;
  const workspace = await loadTeamWorkspace(account);
  redirectIfSpaceNotIn(workspace, account, ['work']);

  const accountId = workspace.account.id as string;
  const [client, social] = await Promise.all([
    loadClientForTeam(clientId, accountId),
    loadFeedflowSocialAccountsForClient(clientId, accountId),
  ]);

  if (!client) {
    notFound();
  }

  return (
    <>
      <TeamAccountLayoutPageHeader
        account={account}
        title={`Reviews · ${client.display_name}`}
        description="Social sources linked to this CRM client for Feedflow."
      />
      <PageBody className="space-y-8 bg-[var(--workspace-shell-canvas)] px-0 py-8 text-[var(--workspace-shell-text)] lg:px-6">
        <ModuleDataSection title="Connected sources for this client">
          {social.length === 0 ? (
            <ModuleEmptyState message="No feedflow.social_accounts rows for this client yet. Associate connections with client_id to see them here." />
          ) : (
            <div className="overflow-x-auto rounded-lg border border-white/10">
              <table className="w-full min-w-[28rem] text-left text-sm">
                <thead className="border-b border-white/10 bg-black/20 text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3">Platform</th>
                    <th className="px-4 py-3">External id</th>
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

        <div className="flex flex-wrap gap-3 text-sm">
          <Link
            href={workAccountPath(workPaths.accountClients, account)}
            className="rounded-lg border border-white/10 bg-black/10 px-4 py-2 transition hover:border-white/20"
          >
            Back to clients
          </Link>
          <Link
            href={workAccountPath(workPaths.accountFeedflowReviews, account)}
            className="rounded-lg border border-white/10 bg-black/10 px-4 py-2 transition hover:border-white/20"
          >
            All reviews overview
          </Link>
        </div>
      </PageBody>
    </>
  );
}
