import Link from 'next/link';

import { PageBody } from '@kit/ui/page';

import {
  getOptionalGoogle,
  getOptionalInstagram,
  getOptionalTikTok,
} from '~/lib/feedflow/env';

import { ModuleDataSection } from '../../../_components/module-data-section';
import { TeamAccountLayoutPageHeader } from '../../../_components/team-account-layout-page-header';
import { loadFeedflowSocialAccountsForTeam } from '../../../_lib/server/feedflow-account-data';
import { loadTeamWorkspace } from '../../../_lib/server/team-account-workspace.loader';
import {
  ADDON_APPS_SPACE_TYPES,
  redirectIfSpaceNotIn,
} from '../../../_lib/server/workspace-route-guard';
import { workAccountPath, workPaths } from '../../../_lib/work-account-path';
import { FeedflowOauthBanner } from '../../_components/feedflow-oauth-banner';
import { FeedflowSocialPanel } from '../../_components/feedflow-social-panel';

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
  redirectIfSpaceNotIn(workspace, account, ADDON_APPS_SPACE_TYPES);

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
        description="Connect Instagram or TikTok so you can embed live feeds on your website."
      />
      <PageBody className="space-y-8 bg-[var(--workspace-shell-canvas)] px-0 py-8 text-[var(--workspace-shell-text)] lg:px-6">
        {oauthError || sp.feedflow_connected ? (
          <div className="px-4 lg:px-0">
            <FeedflowOauthBanner
              error={oauthError}
              success={sp.feedflow_connected ?? null}
            />
          </div>
        ) : null}

        <ModuleDataSection
          title="Connections"
          description="Linked accounts power Feedflow widgets. Disconnect anytime — existing embeds keep working until you remove the widget."
        >
          <FeedflowSocialPanel
            accountSlug={account}
            accountId={accountId}
            accounts={rows}
            instagramEnabled={instagramEnabled}
            tiktokEnabled={tiktokEnabled}
            googleConfigured={googleConfigured}
          />
        </ModuleDataSection>

        <div className="flex flex-wrap gap-3 px-4 text-sm lg:px-0">
          <Link
            href={workAccountPath(workPaths.accountFeedflowWidgets, account)}
            className="rounded-lg border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] px-4 py-2 transition-colors hover:bg-[var(--workspace-shell-sidebar-accent)]"
          >
            Widgets
          </Link>
          <Link
            href={workAccountPath(workPaths.accountFeedflowReviews, account)}
            className="rounded-lg border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] px-4 py-2 transition-colors hover:bg-[var(--workspace-shell-sidebar-accent)]"
          >
            Reviews
          </Link>
        </div>
      </PageBody>
    </>
  );
}
