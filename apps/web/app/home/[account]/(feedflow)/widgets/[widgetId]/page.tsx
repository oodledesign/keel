import Link from 'next/link';
import { notFound } from 'next/navigation';

import { PageBody } from '@kit/ui/page';

import { TeamAccountLayoutPageHeader } from '../../../_components/team-account-layout-page-header';
import { loadFeedflowWidgetForTeam } from '../../../_lib/server/feedflow-account-data';
import { loadTeamWorkspace } from '../../../_lib/server/team-account-workspace.loader';
import {
  ADDON_APPS_SPACE_TYPES,
  redirectIfSpaceNotIn,
} from '../../../_lib/server/workspace-route-guard';
import { workAccountPath, workPaths } from '../../../_lib/work-account-path';
import { FeedflowWidgetEditor } from '../../_components/feedflow-widget-editor';

type FeedflowWidgetPageProps = {
  params: Promise<{
    account: string;
    widgetId: string;
  }>;
};

export default async function FeedflowWidgetPage({
  params,
}: FeedflowWidgetPageProps) {
  const { account, widgetId } = await params;
  const workspace = await loadTeamWorkspace(account);
  redirectIfSpaceNotIn(workspace, account, ADDON_APPS_SPACE_TYPES);

  const widget = await loadFeedflowWidgetForTeam(
    workspace.account.id,
    widgetId,
  );
  if (!widget) {
    notFound();
  }

  return (
    <>
      <TeamAccountLayoutPageHeader
        account={account}
        title={widget.name}
        description="Settings on the left update the preview straight away. Save to publish them to the embed."
      />
      <PageBody className="space-y-8 bg-[var(--workspace-shell-canvas)] px-0 py-8 text-[var(--workspace-shell-text)] lg:px-6">
        <Link
          href={workAccountPath(workPaths.accountFeedflowWidgets, account)}
          className="text-sm text-[var(--workspace-shell-text-muted)] underline-offset-4 hover:underline"
        >
          All widgets
        </Link>
        <FeedflowWidgetEditor
          accountId={workspace.account.id}
          origin={process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') ?? ''}
          widget={widget}
        />
      </PageBody>
    </>
  );
}
