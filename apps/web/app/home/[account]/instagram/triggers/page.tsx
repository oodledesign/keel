import Link from 'next/link';

import { PageBody } from '@kit/ui/page';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

import {
  deleteIgTrigger,
  toggleIgTrigger,
} from '../(instagram-autoreply)/_lib/server/instagram-autoreply-actions';
import { InstagramTriggersList } from '../(instagram-autoreply)/_components/instagram-triggers-list';
import { TeamAccountLayoutPageHeader } from '../_components/team-account-layout-page-header';
import { loadTeamWorkspace } from '../_lib/server/team-account-workspace.loader';
import {
  ADDON_APPS_SPACE_TYPES,
  redirectIfSpaceNotIn,
} from '../_lib/server/workspace-route-guard';
import { workAccountPath, workPaths } from '../_lib/work-account-path';
import { loadIgTriggers } from '~/lib/instagram-autoreply/assert-access';

type InstagramTriggersPageProps = {
  params: Promise<{ account: string }>;
};

export default async function InstagramTriggersPage({
  params,
}: InstagramTriggersPageProps) {
  const { account } = await params;
  const workspace = await loadTeamWorkspace(account);
  redirectIfSpaceNotIn(workspace, account, ADDON_APPS_SPACE_TYPES);

  const accountId = workspace.account.id as string;
  const client = getSupabaseServerClient();
  const triggers = await loadIgTriggers(client, accountId);

  return (
    <>
      <TeamAccountLayoutPageHeader
        account={account}
        title="Instagram triggers"
        description="Keyword rules that fire public replies, DMs, and optional CRM leads."
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
        <InstagramTriggersList
          accountSlug={account}
          accountId={accountId}
          triggers={triggers as Array<{
            id: string;
            name: string;
            keywords: string[];
            is_active: boolean;
          }>}
          onToggle={toggleIgTrigger}
          onDelete={deleteIgTrigger}
        />
      </PageBody>
    </>
  );
}
