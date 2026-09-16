import { redirect } from 'next/navigation';

import { getSupabaseServerClient } from '@kit/supabase/server-client';

import {
  getDefaultAccountPath,
  getTeamAccountAccess,
} from '../../_lib/role-access';
import { loadTeamWorkspace } from '../../_lib/server/team-account-workspace.loader';
import { redirectIfSpaceNotIn } from '../../_lib/server/workspace-route-guard';
import { createSurveyTemplatesService } from '../../surveys/_lib/server/survey-templates.service';
import { SurveyTemplatesSettingsClient } from './_components/survey-templates-settings-client';

export const generateMetadata = async () => ({
  title: 'Survey templates',
});

interface PageProps {
  params: Promise<{ account: string }>;
}

export default async function SurveyTemplatesSettingsPage(props: PageProps) {
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

  const templates = await createSurveyTemplatesService(
    getSupabaseServerClient(),
  ).list(workspace.account.id as string);

  return (
    <SurveyTemplatesSettingsClient
      accountId={workspace.account.id as string}
      accountSlug={account}
      canEdit={access.canManageSettings}
      initialTemplates={templates}
    />
  );
}
