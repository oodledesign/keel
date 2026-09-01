import { redirect } from 'next/navigation';

import { getSupabaseServerClient } from '@kit/supabase/server-client';

import { loadAccountSendingDomain } from '~/lib/sending-domains';

import {
  getDefaultAccountPath,
  getTeamAccountAccess,
} from '../../_lib/role-access';
import { loadTeamWorkspace } from '../../_lib/server/team-account-workspace.loader';
import {
  BUSINESS_WORKSPACE_SPACE_TYPES,
  redirectIfSpaceNotIn,
} from '../../_lib/server/workspace-route-guard';
import { SendingDomainSettings } from './_components/sending-domain-settings';

export const generateMetadata = async () => ({
  title: 'Sending domain',
});

interface SendingDomainPageProps {
  params: Promise<{ account: string }>;
}

export default async function SendingDomainPage(props: SendingDomainPageProps) {
  const { account } = await props.params;
  const workspace = await loadTeamWorkspace(account);
  redirectIfSpaceNotIn(workspace, account, BUSINESS_WORKSPACE_SPACE_TYPES);

  const access = getTeamAccountAccess(
    workspace.account as {
      permissions?: string[] | null;
      role?: string | null;
      company_role?: string | null;
    },
  );

  if (!access.canViewSettings) {
    redirect(
      getDefaultAccountPath(
        account,
        workspace.account as {
          permissions?: string[] | null;
          role?: string | null;
          company_role?: string | null;
        },
      ),
    );
  }

  const accountId = workspace.account.id as string;
  const client = getSupabaseServerClient();
  const [sendingDomain, accountRow] = await Promise.all([
    loadAccountSendingDomain(client, accountId),
    client.from('accounts').select('name').eq('id', accountId).maybeSingle(),
  ]);

  if (accountRow.error) {
    throw accountRow.error;
  }

  return (
    <SendingDomainSettings
      accountId={accountId}
      accountName={accountRow.data?.name?.trim() || account}
      canEdit={access.isOwner || access.isAdmin}
      initialDomain={sendingDomain}
    />
  );
}
