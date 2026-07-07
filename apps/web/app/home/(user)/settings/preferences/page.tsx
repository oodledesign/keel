import { Suspense } from 'react';

import { createI18nServerInstance } from '~/lib/i18n/i18n.server';
import { withI18n } from '~/lib/i18n/with-i18n';

import { KeelUsePreferencesSection } from '../_components/keel-use-preferences-section';
import { PersonalSettingsPanel } from '../_components/personal-settings-panel';

export const generateMetadata = async () => {
  const i18n = await createI18nServerInstance();

  return {
    title: i18n.t('account:preferencesSettingsTitle', {
      defaultValue: 'How you use Keel',
    }),
  };
};

function PersonalPreferencesSettingsPage() {
  return (
    <PersonalSettingsPanel>
      <Suspense
        fallback={
          <p className="text-sm text-[var(--workspace-shell-text-muted)]">
            Loading…
          </p>
        }
      >
        <KeelUsePreferencesSection />
      </Suspense>
    </PersonalSettingsPanel>
  );
}

export default withI18n(PersonalPreferencesSettingsPage);
