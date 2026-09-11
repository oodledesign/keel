import Link from 'next/link';

import pathsConfig from '~/config/paths.config';
import type { DynamicsConnectionPublic } from '~/lib/dynamics/types';
import {
  workspaceCardHover,
  workspacePanelCard,
  workspaceSuccessBadge,
  workspaceText,
  workspaceTextMuted,
} from '~/lib/workspace-ui';

export function WorkspaceIntegrationsHome({
  accountSlug,
  dynamics,
}: {
  accountSlug: string;
  dynamics: DynamicsConnectionPublic;
}) {
  const dynamicsHref =
    pathsConfig.app.accountIntegrationsDynamicsSettings.replace(
      '[account]',
      accountSlug,
    );

  return (
    <div
      className="flex flex-col gap-6"
      data-test="workspace-integrations-home"
    >
      <div>
        <h2 className={`text-lg font-semibold ${workspaceText}`}>
          Integrations
        </h2>
        <p className={`mt-1 text-sm ${workspaceTextMuted}`}>
          Connect third-party tools to this workspace. More integrations will
          land here using the same card pattern.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Link
          href={dynamicsHref}
          className={`${workspacePanelCard} ${workspaceCardHover} block p-5`}
          data-test="workspace-integration-card-dynamics"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className={`text-sm font-semibold ${workspaceText}`}>
                Dynamics 365
              </h3>
              <p className={`mt-1 text-sm ${workspaceTextMuted}`}>
                Sync mailing-list signups to Dataverse Contacts with
                marketing-consent flags. Ozer stays the emailable source of
                truth.
              </p>
            </div>
            <span
              className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
                dynamics.connected
                  ? workspaceSuccessBadge
                  : `${workspaceTextMuted} border border-[color:var(--workspace-shell-border)]`
              }`}
            >
              {dynamics.connected ? 'Connected' : 'Not connected'}
            </span>
          </div>
          <p
            className={`mt-4 text-sm font-medium text-[var(--workspace-shell-accent-text)]`}
          >
            Configure
          </p>
        </Link>
      </div>
    </div>
  );
}
