import { redirect } from 'next/navigation';

import { getSupabaseServerClient } from '@kit/supabase/server-client';

import { ToneOfVoiceSettingsClient } from '~/components/voice/tone-of-voice-settings-client';
import { loadBrandVoicePageData } from '~/lib/voice/load-voice-profile-page';

import {
  getDefaultAccountPath,
  getTeamAccountAccess,
} from '../../_lib/role-access';
import { loadTeamWorkspace } from '../../_lib/server/team-account-workspace.loader';
import {
  BUSINESS_WORKSPACE_SPACE_TYPES,
  redirectIfSpaceNotIn,
} from '../../_lib/server/workspace-route-guard';

export const generateMetadata = async () => ({
  title: 'Brand voice',
});

interface BrandVoiceSettingsPageProps {
  params: Promise<{ account: string }>;
}

export default async function BrandVoiceSettingsPage(
  props: BrandVoiceSettingsPageProps,
) {
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
  const data = await loadBrandVoicePageData(client, accountId);
  const canEdit = access.canManageSettings;

  return (
    <ToneOfVoiceSettingsClient
      key={data.profile.updatedAt}
      scope={{
        kind: 'brand',
        accountId,
        accountSlug: account,
      }}
      initial={data}
      canEdit={canEdit}
    />
  );
}
