import { redirect } from 'next/navigation';

import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { createTeamAccountsApi } from '@kit/team-accounts/api';
import {
  TeamAccountDangerZone,
  TeamAccountSettingsContainer,
} from '@kit/team-accounts/components';
import { AppBreadcrumbs } from '@kit/ui/app-breadcrumbs';
import { PageBody } from '@kit/ui/page';
import { Trans } from '@kit/ui/trans';

import featuresFlagConfig from '~/config/feature-flags.config';
import pathsConfig from '~/config/paths.config';
import { createI18nServerInstance } from '~/lib/i18n/i18n.server';
import { requireUserInServerComponent } from '~/lib/server/require-user-in-server-component';
import { getDefaultAccountPath, getTeamAccountAccess } from '../_lib/role-access';
import { loadTeamWorkspace } from '../_lib/server/team-account-workspace.loader';

// local imports
import { TeamAccountLayoutPageHeader } from '../_components/team-account-layout-page-header';

export const generateMetadata = async () => {
  const i18n = await createI18nServerInstance();
  const title = i18n.t('teams:settings:pageTitle');

  return {
    title,
  };
};

interface TeamAccountSettingsPageProps {
  params: Promise<{ account: string }>;
}

const paths = {
  teamAccountSettings: pathsConfig.app.accountSettings,
};

async function TeamAccountSettingsPage(props: TeamAccountSettingsPageProps) {
  const client = getSupabaseServerClient();
  const user = await requireUserInServerComponent();
  const api = createTeamAccountsApi(client);
  const slug = (await props.params).account;
  const workspace = await loadTeamWorkspace(slug);
  const access = getTeamAccountAccess(
    workspace.account as {
      permissions?: string[] | null;
      role?: string | null;
      company_role?: string | null;
    },
  );

  if (!access.canViewSettings) {
    redirect(getDefaultAccountPath(slug, workspace.account));
  }

  const data = await api.getTeamAccount(slug);

  const account = {
    id: data.id,
    name: data.name,
    pictureUrl: data.picture_url,
    slug: data.slug as string,
    primaryOwnerUserId: data.primary_owner_user_id,
  };

  const { data: membership } = await client
    .from('accounts_memberships')
    .select('company_role')
    .eq('account_id', account.id)
    .eq('user_id', user.id)
    .maybeSingle();

  const isClient = membership?.company_role === 'client';
  const features = {
    enableTeamDeletion: featuresFlagConfig.enableTeamDeletion,
  };

  return (
    <>
      <TeamAccountLayoutPageHeader
        account={account.slug}
        title={<Trans i18nKey={'teams:settings.pageTitle'} />}
        description={<AppBreadcrumbs />}
      />

      <PageBody className="bg-[var(--workspace-shell-canvas)] px-4 py-6 text-[var(--workspace-shell-text)] lg:px-6">
        <div className="flex max-w-2xl flex-1 flex-col gap-6 rounded-2xl border border-white/6 bg-[var(--workspace-shell-panel)] p-6 shadow-[0_18px_50px_rgba(4,10,24,0.24)]">
          {isClient ? (
            <TeamAccountDangerZone
              account={account}
              primaryOwnerUserId={account.primaryOwnerUserId}
              features={features}
            />
          ) : (
            <TeamAccountSettingsContainer
              account={account}
              paths={paths}
              features={features}
            />
          )}
        </div>
      </PageBody>
    </>
  );
}

export default TeamAccountSettingsPage;
