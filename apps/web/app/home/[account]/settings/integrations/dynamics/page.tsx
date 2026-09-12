import Link from 'next/link';
import { redirect } from 'next/navigation';

import { Trans } from '@kit/ui/trans';

import pathsConfig from '~/config/paths.config';
import { withI18n } from '~/lib/i18n/with-i18n';
import { workspaceLinkAccent, workspaceTextMuted } from '~/lib/workspace-ui';

import {
  getDefaultAccountPath,
  getTeamAccountAccess,
} from '../../../_lib/role-access';
import { loadTeamWorkspace } from '../../../_lib/server/team-account-workspace.loader';
import { DynamicsSettingsPanel } from '../_components/dynamics-settings-panel';
import {
  loadDynamicsConnection,
  loadDynamicsInboundStub,
} from '../_lib/server/dynamics.loader';

interface DynamicsSettingsPageProps {
  params: Promise<{ account: string }>;
}

export const generateMetadata = async () => ({
  title: 'Dynamics 365',
});

async function DynamicsSettingsPage({ params }: DynamicsSettingsPageProps) {
  const accountSlug = (await params).account;
  const workspace = await loadTeamWorkspace(accountSlug);
  const accountAccess = workspace.account as {
    permissions?: string[] | null;
    role?: string | null;
    company_role?: string | null;
  };
  const access = getTeamAccountAccess(accountAccess);

  if (!access.canViewSettings) {
    redirect(getDefaultAccountPath(accountSlug, accountAccess));
  }

  const [connection, inbound] = await Promise.all([
    loadDynamicsConnection(workspace.account.id),
    Promise.resolve(loadDynamicsInboundStub()),
  ]);

  const integrationsHref = pathsConfig.app.accountIntegrationsSettings.replace(
    '[account]',
    accountSlug,
  );

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href={integrationsHref}
          className={`text-sm font-medium ${workspaceLinkAccent}`}
        >
          ← <Trans i18nKey="common:routes.integrations" />
        </Link>
        <h2 className="mt-3 text-lg font-semibold text-[var(--workspace-shell-text)]">
          <Trans i18nKey="common:routes.dynamics" />
        </h2>
        <p className={`mt-1 text-sm ${workspaceTextMuted}`}>
          <Trans i18nKey="common:workspaceIntegrationsDynamicsDescription" />
        </p>
      </div>
      <DynamicsSettingsPanel
        accountId={workspace.account.id}
        accountSlug={accountSlug}
        connection={connection}
        canEdit={access.isOwner || access.isAdmin}
        inboundNote={inbound.summary}
      />
    </div>
  );
}

export default withI18n(DynamicsSettingsPage);
