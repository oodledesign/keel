import { Suspense } from 'react';

import { createI18nServerInstance } from '~/lib/i18n/i18n.server';
import { withI18n } from '~/lib/i18n/with-i18n';

import { ConnectToClaudeSettingsSection } from '../_components/connect-to-claude-settings-section';
import { PersonalIntegrationsSettingsSection } from '../_components/personal-integrations-settings-section';
import { PersonalSettingsPanel } from '../_components/personal-settings-panel';

export const generateMetadata = async () => {
  const i18n = await createI18nServerInstance();

  return {
    title: i18n.t('account:integrationsSettingsTitle', {
      defaultValue: 'Integrations',
    }),
  };
};

function PersonalIntegrationsSettingsPage() {
  return (
    <PersonalSettingsPanel
      title="Integrations"
      description="Connect Google Calendar and Gmail once here. Planner and Email keep their own shortcuts too."
    >
      <Suspense
        fallback={
          <p className="text-sm text-[var(--workspace-shell-text-muted)]">
            Loading…
          </p>
        }
      >
        <PersonalIntegrationsSettingsSection />
      </Suspense>
      <div className="mt-4">
        <ConnectToClaudeSettingsSection />
      </div>
    </PersonalSettingsPanel>
  );
}

export default withI18n(PersonalIntegrationsSettingsPage);
