import { listIntegrationConnectInvites } from '~/lib/signatures/integration-invite';
import { isSignaturesManualModeEnabled } from '~/lib/signatures/workspace-settings';

import { ModuleDataSection } from '../../../_components/module-data-section';
import { SignaturesIntegrationLinksCard } from '../../_components/signatures-integration-links-card';
import { SignaturesSettingsPanel } from '../../_components/signatures-settings-panel';
import {
  loadGoogleConnection,
  loadMsConnection,
  loadSignaturesWorkspace,
} from '../../_lib/server/signatures-data';

type PageProps = {
  params: Promise<{ account: string }>;
  searchParams: Promise<{ connected?: string }>;
};

export default async function SignaturesIntegrationsPage({
  params,
  searchParams,
}: PageProps) {
  const { account } = await params;
  const sp = await searchParams;
  const workspace = await loadSignaturesWorkspace(account);
  const accountId = workspace.account.id as string;
  const [msConnection, googleConnection, integrationInvites, manualMode] =
    await Promise.all([
      loadMsConnection(accountId),
      loadGoogleConnection(accountId),
      listIntegrationConnectInvites(accountId),
      isSignaturesManualModeEnabled(accountId),
    ]);

  const accountName =
    (workspace.account.name as string | null | undefined)?.trim() || account;
  const hasProvider = Boolean(msConnection || googleConnection);

  return (
    <ModuleDataSection
      title="Integrations"
      description="Connect Microsoft 365 or Google Workspace, and share one-time admin invite links."
    >
      <div className="space-y-6">
        {manualMode && !hasProvider ? (
          <div
            className="rounded-xl border border-[var(--ozer-accent)]/20 bg-[var(--ozer-accent-subtle)] px-4 py-3 text-sm text-[var(--workspace-shell-text)]"
            role="status"
          >
            <p className="font-semibold">Running in manual mode</p>
            <p className="mt-1 text-[var(--workspace-shell-text-muted)]">
              Staff and templates work without OAuth. Connect a mail provider
              below to unlock directory Sync and Push. Existing manual or CSV
              people are kept.
            </p>
          </div>
        ) : null}
        <SignaturesIntegrationLinksCard
          accountId={accountId}
          accountName={accountName}
          initialInvites={integrationInvites}
        />
        <SignaturesSettingsPanel
          accountId={accountId}
          accountSlug={account}
          msConnection={msConnection}
          googleConnection={googleConnection}
          connected={sp.connected === 'true'}
        />
      </div>
    </ModuleDataSection>
  );
}
