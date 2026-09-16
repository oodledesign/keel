import { redirect } from 'next/navigation';

import { getSupabaseServerClient } from '@kit/supabase/server-client';

import {
  getDefaultAccountPath,
  getTeamAccountAccess,
} from '../../_lib/role-access';
import { loadTeamWorkspace } from '../../_lib/server/team-account-workspace.loader';
import { redirectIfSpaceNotIn } from '../../_lib/server/workspace-route-guard';
import { createSurveyPhrasesService } from '../../surveys/_lib/server/survey-phrases.service';
import { SurveyPhrasesSettingsClient } from './_components/survey-phrases-settings-client';

export const generateMetadata = async () => ({
  title: 'Phrase banks',
});

interface PageProps {
  params: Promise<{ account: string }>;
}

export default async function SurveyPhrasesSettingsPage(props: PageProps) {
  const { account } = await props.params;
  const workspace = await loadTeamWorkspace(account);
  redirectIfSpaceNotIn(workspace, account, ['building-surveyor']);

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

  const banks = await createSurveyPhrasesService(
    getSupabaseServerClient(),
  ).listBanks(workspace.account.id as string);

  return (
    <SurveyPhrasesSettingsClient
      accountId={workspace.account.id as string}
      accountSlug={account}
      canEdit={access.canManageSettings}
      initialBanks={banks}
    />
  );
}
