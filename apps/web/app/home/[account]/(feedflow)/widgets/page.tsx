import Link from 'next/link';

import { PageBody } from '@kit/ui/page';

import { TeamAccountLayoutPageHeader } from '../../_components/team-account-layout-page-header';
import { ModuleDataSection } from '../../_components/module-data-section';
import { FeedflowOauthBanner } from '../_components/feedflow-oauth-banner';
import { FeedflowWidgetsManager } from '../_components/feedflow-widgets-manager';
import {
  loadFeedflowSocialAccountsForTeam,
  loadFeedflowWidgetsForTeam,
} from '../../_lib/server/feedflow-account-data';
import { loadTeamWorkspace } from '../../_lib/server/team-account-workspace.loader';
import { redirectIfSpaceNotIn } from '../../_lib/server/workspace-route-guard';
import { workAccountPath, workPaths } from '../../_lib/work-account-path';

type FeedflowWidgetsPageProps = {
  params: Promise<{
    account: string;
  }>;
  searchParams: Promise<{
    feedflow_error?: string;
    feedflow_connected?: string;
  }>;
};

export default async function FeedflowWidgetsPage({
  params,
  searchParams,
}: FeedflowWidgetsPageProps) {
  const { account } = await params;
  const sp = await searchParams;
  const workspace = await loadTeamWorkspace(account);
  redirectIfSpaceNotIn(workspace, account, ['work']);

  const accountId = workspace.account.id;
  const [widgets, social] = await Promise.all([
    loadFeedflowWidgetsForTeam(accountId),
    loadFeedflowSocialAccountsForTeam(accountId),
  ]);

  let oauthError: string | null = null;
  if (sp.feedflow_error) {
    try {
      oauthError = decodeURIComponent(sp.feedflow_error);
    } catch {
      oauthError = sp.feedflow_error;
    }
  }

  return (
    <>
      <TeamAccountLayoutPageHeader
        account={account}
        title="Feedflow widgets"
        description="Create embeddable grids tied to a connected social account."
      />
      <PageBody className="space-y-8 bg-[var(--workspace-shell-canvas)] px-0 py-8 text-[var(--workspace-shell-text)] lg:px-6">
        <FeedflowOauthBanner
          error={oauthError}
          success={sp.feedflow_connected ?? null}
        />

        <ModuleDataSection title="Widgets">
          <FeedflowWidgetsManager
            accountId={accountId}
            socialAccounts={social}
            widgets={widgets}
          />
        </ModuleDataSection>

        <Link
          href={workAccountPath(workPaths.accountFeedflowReviews, account)}
          className="inline-block rounded-lg border border-[color:var(--workspace-shell-border)] bg-black/10 px-4 py-2 text-sm transition hover:border-[color:var(--workspace-shell-border)]"
        >
          Back to reviews overview
        </Link>
      </PageBody>
    </>
  );
}
