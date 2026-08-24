import Link from 'next/link';

import { PageBody } from '@kit/ui/page';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

import { InstagramActivityFeed } from '../../(instagram-autoreply)/_components/instagram-activity-feed';
import { TeamAccountLayoutPageHeader } from '../../_components/team-account-layout-page-header';
import { loadTeamWorkspace } from '../../_lib/server/team-account-workspace.loader';
import {
  ADDON_APPS_SPACE_TYPES,
  redirectIfSpaceNotIn,
} from '../../_lib/server/workspace-route-guard';
import { workAccountPath, workPaths } from '../../_lib/work-account-path';
import { loadIgCommentEvents } from '~/lib/instagram-autoreply/assert-access';

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
        <div className="mx-4 lg:mx-0">
          <Link
            href={workAccountPath(workPaths.accountInstagramAutoreply, account)}
            className="text-sm text-[color:var(--ozer-accent)] hover:underline"
          >
            ← Back to Instagram
          </Link>
        </div>
        <InstagramActivityFeed accountSlug={account} events={events} />
      </PageBody>
    </>
  );
}
