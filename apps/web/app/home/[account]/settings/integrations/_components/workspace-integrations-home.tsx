import Link from 'next/link';

import { Trans } from '@kit/ui/trans';

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
          <Trans i18nKey="common:routes.integrations" />
        </h2>
        <p className={`mt-1 text-sm ${workspaceTextMuted}`}>
          <Trans i18nKey="common:workspaceIntegrationsDescription" />
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
                <Trans i18nKey="common:routes.dynamics" />
              </h3>
              <p className={`mt-1 text-sm ${workspaceTextMuted}`}>
                <Trans i18nKey="common:workspaceIntegrationsDynamicsBlurb" />
              </p>
            </div>
            <span
              className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
                dynamics.connected
                  ? workspaceSuccessBadge
                  : `${workspaceTextMuted} border border-[color:var(--workspace-shell-border)]`
              }`}
            >
              {dynamics.connected ? (
                <Trans i18nKey="common:workspaceIntegrationsConnected" />
              ) : (
                <Trans i18nKey="common:workspaceIntegrationsNotConnected" />
              )}
            </span>
          </div>
          <p
            className={`mt-4 text-sm font-medium text-[var(--workspace-shell-accent-text)]`}
          >
            <Trans i18nKey="common:workspaceIntegrationsConfigure" />
          </p>
        </Link>
      </div>
    </div>
  );
}
