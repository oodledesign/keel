import { Suspense } from 'react';

import { createI18nServerInstance } from '~/lib/i18n/i18n.server';
import { withI18n } from '~/lib/i18n/with-i18n';

import { PersonalSettingsPanel } from '../_components/personal-settings-panel';
import { PersonalVisionSettingsSection } from './_components/personal-vision-settings-section';

export const generateMetadata = async () => {
  const i18n = await createI18nServerInstance();

  return {
    title: i18n.t('account:visionSettingsTitle', {
      defaultValue: 'Personal Vision',
    }),
  };
};

function PersonalVisionSettingsPage() {
  return (
    <PersonalSettingsPanel>
      <Suspense
        fallback={
          <p className="text-sm text-[var(--workspace-shell-text-muted)]">
            Loading…
          </p>
        }
      >
        <PersonalVisionSettingsSection />
      </Suspense>
    </PersonalSettingsPanel>
  );
}

export default withI18n(PersonalVisionSettingsPage);
