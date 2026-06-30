import Link from 'next/link';

import { PageBody } from '@kit/ui/page';

import { getOptionalGoogle, getOptionalInstagram, getOptionalTikTok } from '~/lib/feedflow/env';

import { TeamAccountLayoutPageHeader } from '../../../_components/team-account-layout-page-header';
import { FeedflowOauthBanner } from '../../_components/feedflow-oauth-banner';
import { FeedflowSocialPanel } from '../../_components/feedflow-social-panel';
import { loadFeedflowSocialAccountsForTeam } from '../../../_lib/server/feedflow-account-data';
import { loadTeamWorkspace } from '../../../_lib/server/team-account-workspace.loader';
import { redirectIfSpaceNotIn } from '../../../_lib/server/workspace-route-guard';
import { workAccountPath, workPaths } from '../../../_lib/work-account-path';

type FeedflowSocialAccountsPageProps = {
  params: Promise<{
    account: string;
  }>;
  searchParams: Promise<{
    feedflow_error?: string;
    feedflow_connected?: string;
  }>;
};

export default async function FeedflowSocialAccountsPage({
  params,
  searchParams,
}: FeedflowSocialAccountsPageProps) {
  const { account } = await params;
  const sp = await searchParams;
  const workspace = await loadTeamWorkspace(account);
  redirectIfSpaceNotIn(workspace, account, ['work']);

  const accountId = workspace.account.id as string;
  const rows = await loadFeedflowSocialAccountsForTeam(accountId);

  let oauthError: string | null = null;
  if (sp.feedflow_error) {
    try {
      oauthError = decodeURIComponent(sp.feedflow_error);
    } catch {
      oauthError = sp.feedflow_error;
    }
  }

  const instagramEnabled = getOptionalInstagram() !== null;
  const tiktokEnabled = getOptionalTikTok() !== null;
  const googleConfigured = getOptionalGoogle() !== null;

  return (
    <>
      <TeamAccountLayoutPageHeader
        account={account}
        title="Social accounts"
        description="Connect Instagram or TikTok for feed widgets. Callback URLs live under /api/feedflow/auth/*/callback."
      />
      <PageBody className="space-y-8 bg-[var(--workspace-shell-canvas)] px-0 py-8 text-[var(--workspace-shell-text)] lg:px-6">
        <FeedflowOauthBanner
          error={oauthError}
          success={sp.feedflow_connected ?? null}
        />

        <FeedflowSocialPanel
          accountSlug={account}
          accountId={accountId}
          accounts={rows}
          instagramEnabled={instagramEnabled}
          tiktokEnabled={tiktokEnabled}
          googleConfigured={googleConfigured}
        />

        <div className="flex flex-wrap gap-3 text-sm">
          <Link
            href={workAccountPath(workPaths.accountFeedflowReviews, account)}
            className="rounded-lg border border-[color:var(--workspace-shell-border)] bg-black/10 px-4 py-2 transition hover:border-[color:var(--workspace-shell-border)]"
          >
            Reviews & widgets
          </Link>
          <Link
            href={workAccountPath(workPaths.accountClients, account)}
            className="rounded-lg border border-[color:var(--workspace-shell-border)] bg-black/10 px-4 py-2 transition hover:border-[color:var(--workspace-shell-border)]"
          >
            CRM clients
          </Link>
        </div>
      </PageBody>
    </>
  );
}
