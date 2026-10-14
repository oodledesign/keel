import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { PageBody } from '@kit/ui/page';

import { loadIgTriggers } from '~/lib/instagram-autoreply/assert-access';

import { TRIGGER_TYPE_LABELS } from '../../(instagram-autoreply)/_components/builder/builder-model';
import { InstagramSubnav } from '../../(instagram-autoreply)/_components/instagram-subnav';
import { InstagramTriggersList } from '../../(instagram-autoreply)/_components/instagram-triggers-list';
import {
  deleteIgTrigger,
  toggleIgTrigger,
} from '../../(instagram-autoreply)/_lib/server/instagram-autoreply-actions';
import { TeamAccountLayoutPageHeader } from '../../_components/team-account-layout-page-header';
import { loadTeamWorkspace } from '../../_lib/server/team-account-workspace.loader';
import {
  ADDON_APPS_SPACE_TYPES,
  redirectIfSpaceNotIn,
} from '../../_lib/server/workspace-route-guard';

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
        title="Instagram automations"
        description="What starts each automation, and the messages it sends."
      />
      <PageBody className="space-y-6 bg-[var(--workspace-shell-canvas)] px-0 py-8 text-[var(--workspace-shell-text)] lg:px-6">
        <InstagramSubnav account={account} />
        <InstagramTriggersList
          accountSlug={account}
          accountId={accountId}
          triggers={triggers.map((t) => ({
            id: t.id,
            name: t.name,
            keywords: t.keywords ?? [],
            is_active: t.is_active,
            typeLabel:
              TRIGGER_TYPE_LABELS[
                t.trigger_type as keyof typeof TRIGGER_TYPE_LABELS
              ] ?? 'Comment keyword',
          }))}
          onToggle={toggleIgTrigger}
          onDelete={deleteIgTrigger}
        />
      </PageBody>
    </>
  );
}
