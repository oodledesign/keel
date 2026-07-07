import { Suspense, use } from 'react';

import { PersonalAccountSettingsContainer } from '@kit/accounts/personal-account-settings';

import authConfig from '~/config/auth.config';
import featureFlagsConfig from '~/config/feature-flags.config';
import pathsConfig from '~/config/paths.config';
import { createI18nServerInstance } from '~/lib/i18n/i18n.server';
import { withI18n } from '~/lib/i18n/with-i18n';
import { requireUserInServerComponent } from '~/lib/server/require-user-in-server-component';

import { PersonalSettingsPanel } from './_components/personal-settings-panel';

const showEmailOption =
  authConfig.providers.password ||
  authConfig.providers.magicLinkSignIn ||
  authConfig.providers.otp;

const features = {
  showLinkEmailOption: showEmailOption,
  enablePasswordUpdate: authConfig.providers.password,
  enableAccountDeletion: featureFlagsConfig.enableAccountDeletion,
  enableAccountLinking: authConfig.enableIdentityLinking,
};

const providers = authConfig.providers.oAuth;

const callbackPath = pathsConfig.auth.callback;
const accountSettingsPath = pathsConfig.app.accountSettings;

const paths = {
  callback: callbackPath + `?next=${accountSettingsPath}`,
};

export const generateMetadata = async () => {
  const i18n = await createI18nServerInstance();
  const title = i18n.t('account:settingsTab');

  return {
    title,
  };
};

function PersonalAccountSettingsPage() {
  const user = use(requireUserInServerComponent());

  return (
    <PersonalSettingsPanel>
      <PersonalAccountSettingsContainer
        userId={user.id}
        features={features}
        paths={paths}
        providers={providers}
      />
    </PersonalSettingsPanel>
  );
}

export default withI18n(PersonalAccountSettingsPage);
