import { getSupabaseServerClient } from '@kit/supabase/server-client';

import { loadTeamWorkspace } from '../../_lib/server/team-account-workspace.loader';
import { redirectIfSpaceNotIn } from '../../_lib/server/workspace-route-guard';
import { createSurveyReportDetailsService } from '../../surveys/_lib/server/survey-report-details.service';
import { CoverImageSettings } from './_components/cover-image-settings';
import { DroneFeeSettings } from './_components/drone-fee-settings';
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
  const details = createSurveyReportDetailsService(getSupabaseServerClient());
  const [profile, droneFeePence, coverUrl] = await Promise.all([
    details.getMyProfile(accountId),
    details.getDroneDefaultFee(accountId),
    details.getCoverDefaultUrl(accountId),
  ]);

  return (
    <div className="space-y-6">
      <SurveyorProfileForm
        accountId={accountId}
        accountSlug={account}
        initialProfile={profile}
      />
      <CoverImageSettings
        accountId={accountId}
        accountSlug={account}
        initialUrl={coverUrl}
      />
      <DroneFeeSettings
        accountId={accountId}
        accountSlug={account}
        initialFeePence={droneFeePence}
      />
    </div>
  );
}
