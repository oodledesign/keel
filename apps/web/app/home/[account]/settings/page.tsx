import { redirect } from 'next/navigation';

import Link from 'next/link';

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
import { isVideosModuleEnabled } from '../_lib/server/account-modules';
import { loadTeamWorkspace } from '../_lib/server/team-account-workspace.loader';

// local imports
import { TeamAccountLayoutPageHeader } from '../_components/team-account-layout-page-header';
import { RestoreWorkspaceModulesCard } from './_components/restore-workspace-modules-card';
import { WorkspaceDashboardShortcutsSection } from './_components/workspace-dashboard-shortcuts-section';

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

  const brandPath = pathsConfig.app.accountBrandSettings.replace(
    '[account]',
    account.slug,
  );
  const videoSettingsPath = pathsConfig.app.accountVideoSettings.replace(
    '[account]',
    account.slug,
  );
  const videosModuleEnabled = isVideosModuleEnabled(workspace.moduleSettings);

  return (
    <>
      <TeamAccountLayoutPageHeader
        account={account.slug}
        title={<Trans i18nKey={'teams:settings.pageTitle'} />}
        description={<AppBreadcrumbs />}
      />

      <PageBody className="bg-[var(--workspace-shell-canvas)] px-0 py-6 text-[var(--workspace-shell-text)] lg:px-6">
        <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 lg:px-0">
        {!isClient && (access.isOwner || access.isAdmin) ? (
          <RestoreWorkspaceModulesCard
            accountId={account.id}
            accountSlug={account.slug}
            workspaceProfile={workspace.workspaceProfile}
          />
        ) : null}

        {!isClient ? (
          <div className="mx-auto flex max-w-2xl flex-col gap-3 rounded-2xl border border-white/10 bg-[var(--workspace-shell-panel)] p-5 shadow-[0_18px_50px_rgba(4,10,24,0.24)]">
            <div>
              <h2 className="text-base font-semibold">Dashboard shortcuts</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Pin quick links to the top of this workspace&apos;s dashboard.
              </p>
            </div>
            <WorkspaceDashboardShortcutsSection
              accountId={account.id}
              accountSlug={account.slug}
            />
          </div>
        ) : null}

        {!isClient ? (
          <div className="mx-auto mb-6 flex max-w-2xl flex-col gap-3 rounded-2xl border border-white/10 bg-[var(--workspace-shell-panel)] p-5 shadow-[0_18px_50px_rgba(4,10,24,0.24)]">
            <div>
              <h2 className="text-base font-semibold">Invoice payments</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Stripe Connect and bank transfer details for client invoice payments.
              </p>
            </div>
            <Link
              href={pathsConfig.app.accountPaymentSettings.replace('[account]', account.slug)}
              className="inline-flex text-sm font-medium text-[var(--keel-teal)] hover:underline"
            >
              Manage payment settings →
            </Link>
          </div>
        ) : null}

        {!isClient ? (
          <div className="mx-auto mb-6 flex max-w-2xl flex-col gap-3 rounded-2xl border border-white/10 bg-[var(--workspace-shell-panel)] p-5 shadow-[0_18px_50px_rgba(4,10,24,0.24)]">
            <div>
              <h2 className="text-base font-semibold">Brand appearance</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Colours and logo used on invoice emails, signature templates, and
                other branded surfaces.
              </p>
            </div>
            <Link
              href={brandPath}
              className="inline-flex text-sm font-medium text-[var(--keel-teal)] hover:underline"
            >
              Manage brand settings →
            </Link>
          </div>
        ) : null}

        {!isClient && videosModuleEnabled ? (
          <div className="mx-auto mb-6 flex max-w-2xl flex-col gap-3 rounded-2xl border border-white/10 bg-[var(--workspace-shell-panel)] p-5 shadow-[0_18px_50px_rgba(4,10,24,0.24)]">
            <div>
              <h2 className="text-base font-semibold">Video hosting</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Bunny Stream credentials, default player preset, and module
                configuration.
              </p>
            </div>
            <Link
              href={videoSettingsPath}
              className="inline-flex text-sm font-medium text-[var(--keel-teal)] hover:underline"
            >
              Manage video settings →
            </Link>
          </div>
        ) : null}

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
        </div>
      </PageBody>
    </>
  );
}

export default TeamAccountSettingsPage;
