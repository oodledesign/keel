import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { PageBody } from '@kit/ui/page';

import { loadIgCommentEvents } from '~/lib/instagram-autoreply/assert-access';

import { InstagramActivityFeed } from '../../(instagram-autoreply)/_components/instagram-activity-feed';
import { InstagramSubnav } from '../../(instagram-autoreply)/_components/instagram-subnav';
import { TeamAccountLayoutPageHeader } from '../../_components/team-account-layout-page-header';
import { loadTeamWorkspace } from '../../_lib/server/team-account-workspace.loader';
import {
  ADDON_APPS_SPACE_TYPES,
  redirectIfSpaceNotIn,
} from '../../_lib/server/workspace-route-guard';

type InstagramActivityPageProps = {
  params: Promise<{ account: string }>;
};

export default async function InstagramActivityPage({
  params,
}: InstagramActivityPageProps) {
  const { account } = await params;
  const workspace = await loadTeamWorkspace(account);
  redirectIfSpaceNotIn(workspace, account, ADDON_APPS_SPACE_TYPES);

  const accountId = workspace.account.id as string;
  const client = getSupabaseServerClient();
  const events = await loadIgCommentEvents(client, accountId);

  return (
    <>
      <TeamAccountLayoutPageHeader
        account={account}
        title="Instagram activity"
        description="Recent comment events and auto-reply outcomes."
      />
      <PageBody className="space-y-6 bg-[var(--workspace-shell-canvas)] px-0 py-8 text-[var(--workspace-shell-text)] lg:px-6">
        <InstagramSubnav account={account} />
        <InstagramActivityFeed accountSlug={account} events={events} />
      </PageBody>
    </>
  );
}
