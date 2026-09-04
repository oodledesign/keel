import { redirect } from 'next/navigation';

import { createSesIdentityAdmin } from '@kit/ses';
import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

import {
  createSendingDomainService,
  loadAccountSendingDomain,
} from '~/lib/sending-domains/server';

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
  const canEdit = access.isOwner || access.isAdmin;
  const client = getSupabaseServerClient();
  const [sendingDomain, accountRow] = await Promise.all([
    loadAccountSendingDomain(client, accountId),
    client.from('accounts').select('name').eq('id', accountId).maybeSingle(),
  ]);

  if (accountRow.error) {
    throw accountRow.error;
  }

  let domain = sendingDomain;
  if (canEdit && domain && !domain.instructions_share_token) {
    try {
      const admin = getSupabaseServerAdminClient();
      const service = createSendingDomainService(
        admin,
        createSesIdentityAdmin(),
      );
      const token = await service.ensureInstructionsShareToken(accountId);
      domain = { ...domain, instructions_share_token: token };
    } catch {
      // Share panel stays hidden until a token exists.
    }
  }

  return (
    <SendingDomainSettings
      accountId={accountId}
      accountName={accountRow.data?.name?.trim() || account}
      canEdit={canEdit}
      initialDomain={domain}
    />
  );
}
