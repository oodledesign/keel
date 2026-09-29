import { getSupabaseServerClient } from '@kit/supabase/server-client';

import { loadTeamWorkspace } from '../../_lib/server/team-account-workspace.loader';
import { redirectIfSpaceNotIn } from '../../_lib/server/workspace-route-guard';
import { createSurveyReportDetailsService } from '../../surveys/_lib/server/survey-report-details.service';
import { SurveyorProfileForm } from './_components/surveyor-profile-form';

export const generateMetadata = async () => ({
  title: 'Surveyor profile',
});

interface SurveyorProfilePageProps {
  params: Promise<{ account: string }>;
}

export default async function SurveyorProfilePage(
  props: SurveyorProfilePageProps,
) {
  const { account } = await props.params;
  const workspace = await loadTeamWorkspace(account);
  redirectIfSpaceNotIn(workspace, account, ['building-surveyor']);

  const accountId = workspace.account.id as string;
  const profile = await createSurveyReportDetailsService(
    getSupabaseServerClient(),
  ).getMyProfile(accountId);

  return (
    <SurveyorProfileForm
      accountId={accountId}
      accountSlug={account}
      initialProfile={profile}
    />
  );
}
