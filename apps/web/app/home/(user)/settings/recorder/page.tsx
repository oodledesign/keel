import { Suspense } from 'react';

import Link from 'next/link';

import pathsConfig from '~/config/paths.config';
import { createI18nServerInstance } from '~/lib/i18n/i18n.server';
import { withI18n } from '~/lib/i18n/with-i18n';

import { PersonalApiTokensSection } from '../_components/personal-api-tokens-section';
import { PersonalSettingsPanel } from '../_components/personal-settings-panel';

export const generateMetadata = async () => {
  const i18n = await createI18nServerInstance();

  return {
    title: i18n.t('account:recorderSettingsTitle', {
      defaultValue: 'Desktop recorder',
    }),
  };
};

function PersonalRecorderSettingsPage() {
  return (
    <PersonalSettingsPanel
      title="Desktop recorder"
      description="Create API tokens and view usage limits in your personal settings."
    >
      <Suspense
        fallback={
          <p className="text-sm text-[var(--workspace-shell-text-muted)]">
            Loading…
          </p>
        }
      >
        <PersonalApiTokensSection />
      </Suspense>
      <p className="mt-4 text-sm">
        <Link
          href={pathsConfig.app.personalAccountDictationHistory}
          className="text-[var(--workspace-shell-text-muted)] underline-offset-4 hover:text-[var(--workspace-shell-text)] hover:underline"
        >
          View dictation history
        </Link>
      </p>
    </PersonalSettingsPanel>
  );
}

export default withI18n(PersonalRecorderSettingsPage);
