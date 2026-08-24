import { Suspense, use } from 'react';

import { createI18nServerInstance } from '~/lib/i18n/i18n.server';
import { withI18n } from '~/lib/i18n/with-i18n';
import { requireUserInServerComponent } from '~/lib/server/require-user-in-server-component';

import { PersonalSettingsPanel } from '../_components/personal-settings-panel';
import { RewardsSettingsClient } from './_components/rewards-settings-client';
import { loadRewardsSettingsData } from './_lib/server/rewards.loader';

export const generateMetadata = async () => {
  const i18n = await createI18nServerInstance();

  return {
    title: i18n.t('account:rewardsSettingsTitle', {
      defaultValue: 'Referrals & rewards',
    }),
  };
};

function RewardsSettingsPage() {
  const user = use(requireUserInServerComponent());
  const data = use(loadRewardsSettingsData(user.id));

  return (
    <PersonalSettingsPanel>
      <Suspense
        fallback={
          <p className="text-sm text-[var(--workspace-shell-text-muted)]">
            Loading…
          </p>
        }
      >
        <RewardsSettingsClient
          referralLink={data.referralLink}
          referralCode={data.referralCode}
          rewardCreditTarget={
            data.rewardCreditTarget as 'personal' | 'workspace'
          }
          rewardCreditWorkspaceId={data.rewardCreditWorkspaceId}
          workspaces={data.workspaces}
          referrals={data.referrals}
          totalReferralCreditPence={data.totalReferralCreditPence}
          contentSubmissions={data.contentSubmissions}
          contentCaps={data.contentCaps}
          contentTiersPence={data.contentTiersPence}
        />
      </Suspense>
    </PersonalSettingsPanel>
  );
}

export default withI18n(RewardsSettingsPage);
