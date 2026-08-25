import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';

import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { PageBody } from '@kit/ui/page';

import pathsConfig from '~/config/paths.config';
import type { IgTriggerRow } from '~/lib/instagram-autoreply/types';

import { InstagramTriggerEditor } from '../../../(instagram-autoreply)/_components/instagram-trigger-editor';
import { upsertIgTrigger } from '../../../(instagram-autoreply)/_lib/server/instagram-autoreply-actions';
import { TeamAccountLayoutPageHeader } from '../../../_components/team-account-layout-page-header';
import { loadTeamWorkspace } from '../../../_lib/server/team-account-workspace.loader';
import {
  ADDON_APPS_SPACE_TYPES,
  redirectIfSpaceNotIn,
} from '../../../_lib/server/workspace-route-guard';
import { workAccountPath, workPaths } from '../../../_lib/work-account-path';

type InstagramTriggerDetailPageProps = {
  params: Promise<{ account: string; triggerId: string }>;
};

export default async function InstagramTriggerDetailPage({
  params,
}: InstagramTriggerDetailPageProps) {
  const { account, triggerId } = await params;
  const workspace = await loadTeamWorkspace(account);
  redirectIfSpaceNotIn(workspace, account, ADDON_APPS_SPACE_TYPES);

  const accountId = workspace.account.id as string;
  const client = getSupabaseServerClient();

  let trigger: IgTriggerRow | null = null;

  if (triggerId !== 'new') {
    const { data, error } = await client
      .from('ig_triggers')
      .select('*')
      .eq('id', triggerId)
      .eq('account_id', accountId)
      .maybeSingle();

    if (error) {
      throw new Error(error.message);
    }

    if (!data) {
      notFound();
    }

    trigger = data as IgTriggerRow;
  } else {
    const { data: igAccount } = await client
      .from('ig_connected_accounts')
      .select('id')
      .eq('account_id', accountId)
      .eq('is_active', true)
      .maybeSingle();

    if (!igAccount) {
      redirect(workAccountPath(workPaths.accountInstagramAutoreply, account));
    }
  }

  return (
    <>
      <TeamAccountLayoutPageHeader
        account={account}
        title={trigger ? `Edit: ${trigger.name}` : 'New trigger'}
        description="Configure keywords and reply behaviour."
      />
      <PageBody className="space-y-6 bg-[var(--workspace-shell-canvas)] px-0 py-8 text-[var(--workspace-shell-text)] lg:px-6">
        <div className="mx-4 lg:mx-0">
          <Link
            href={pathsConfig.app.accountInstagramAutoreplyTriggers.replace(
              '[account]',
              account,
            )}
            className="text-sm text-[color:var(--ozer-accent)] hover:underline"
          >
            ← Back to triggers
          </Link>
        </div>
        <InstagramTriggerEditor
          accountId={accountId}
          trigger={trigger}
          onSave={upsertIgTrigger}
        />
      </PageBody>
    </>
  );
}
