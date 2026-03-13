import { use } from 'react';

import { PersonalAccountSettingsContainer } from '@kit/accounts/personal-account-settings';
import { PageBody } from '@kit/ui/page';

import authConfig from '~/config/auth.config';
import featureFlagsConfig from '~/config/feature-flags.config';
import pathsConfig from '~/config/paths.config';
import { createI18nServerInstance } from '~/lib/i18n/i18n.server';
import { withI18n } from '~/lib/i18n/with-i18n';
import { requireUserInServerComponent } from '~/lib/server/require-user-in-server-component';

// Show email option if password, magic link, or OTP is enabled
const showEmailOption =
  authConfig.providers.password ||
  authConfig.providers.magicLink ||
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
    <PageBody className="bg-[var(--workspace-shell-canvas)] px-4 py-6 text-[var(--workspace-shell-text)] lg:px-6">
      <div className="flex w-full flex-1 flex-col lg:max-w-2xl">
        <div className="rounded-2xl border border-white/6 bg-[var(--workspace-shell-panel)] p-6 shadow-[0_18px_50px_rgba(4,10,24,0.24)]">
          <PersonalAccountSettingsContainer
            userId={user.id}
            features={features}
            paths={paths}
            providers={providers}
          />
        </div>
      </div>
    </PageBody>
  );
}

export default withI18n(PersonalAccountSettingsPage);
