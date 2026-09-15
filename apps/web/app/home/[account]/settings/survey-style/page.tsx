import { redirect } from 'next/navigation';

import { getSupabaseServerClient } from '@kit/supabase/server-client';

import {
  getDefaultAccountPath,
  getTeamAccountAccess,
} from '../../_lib/role-access';
import { loadTeamWorkspace } from '../../_lib/server/team-account-workspace.loader';
import { redirectIfSpaceNotIn } from '../../_lib/server/workspace-route-guard';
import { createSurveyStyleService } from '../../surveys/_lib/server/survey-style.service';
import { SurveyStyleSettingsClient } from './_components/survey-style-settings-client';

export const generateMetadata = async () => ({
  title: 'Survey style',
});

interface SurveyStyleSettingsPageProps {
  params: Promise<{ account: string }>;
}

export default async function SurveyStyleSettingsPage(
  props: SurveyStyleSettingsPageProps,
) {
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

  const examples = await createSurveyStyleService(
    getSupabaseServerClient(),
  ).list(workspace.account.id as string);

  return (
    <SurveyStyleSettingsClient
      accountId={workspace.account.id as string}
      accountSlug={account}
      canEdit={access.canManageSettings}
      initialExamples={examples}
    />
  );
}
