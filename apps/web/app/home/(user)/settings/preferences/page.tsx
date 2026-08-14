import { Suspense } from 'react';

import { ProductTourSettingsCard } from '~/components/product-tour/product-tour-settings-card';
import { createI18nServerInstance } from '~/lib/i18n/i18n.server';
import { withI18n } from '~/lib/i18n/with-i18n';

import { OzerUsePreferencesSection } from '../_components/ozer-use-preferences-section';
import { PersonalSettingsPanel } from '../_components/personal-settings-panel';

export const generateMetadata = async () => {
  const i18n = await createI18nServerInstance();

  return {
    title: i18n.t('account:preferencesSettingsTitle', {
      defaultValue: 'How you use Ozer',
    }),
  };
};

function PersonalPreferencesSettingsPage() {
  return (
    <div className="flex flex-col gap-6">
      <ProductTourSettingsCard tourId="personal" />
      <PersonalSettingsPanel>
        <Suspense
          fallback={
            <p className="text-sm text-[var(--workspace-shell-text-muted)]">
              Loading…
            </p>
          }
        >
          <OzerUsePreferencesSection />
        </Suspense>
      </PersonalSettingsPanel>
    </div>
  );
}

export default withI18n(PersonalPreferencesSettingsPage);
