import Link from 'next/link';
import { Suspense, use } from 'react';

import { PersonalAccountSettingsContainer } from '@kit/accounts/personal-account-settings';
import { PageBody } from '@kit/ui/page';

import authConfig from '~/config/auth.config';
import featureFlagsConfig from '~/config/feature-flags.config';
import pathsConfig from '~/config/paths.config';
import { createI18nServerInstance } from '~/lib/i18n/i18n.server';
import { withI18n } from '~/lib/i18n/with-i18n';
import { requireUserInServerComponent } from '~/lib/server/require-user-in-server-component';

import { ConnectToClaudeSettingsSection } from './_components/connect-to-claude-settings-section';
import { KeelUsePreferencesSection } from './_components/keel-use-preferences-section';
import { PersonalApiTokensSection } from './_components/personal-api-tokens-section';
import { PersonalDashboardShortcutsSection } from './_components/personal-dashboard-shortcuts-section';
import { PersonalIntegrationsSettingsSection } from './_components/personal-integrations-settings-section';
import { PersonalIntegrationsToasts } from './_components/personal-integrations-toasts';

// Show email option if password, magic link, or OTP is enabled
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
    <PageBody className="bg-[var(--workspace-shell-canvas)] px-0 py-6 text-[var(--workspace-shell-text)] lg:px-6">
      <Suspense fallback={null}>
        <PersonalIntegrationsToasts />
      </Suspense>
      <div className="flex w-full flex-1 flex-col lg:max-w-2xl">
        <div className="rounded-2xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] p-6 shadow-[0_18px_50px_rgba(4,10,24,0.24)]">
          <PersonalAccountSettingsContainer
            userId={user.id}
            features={features}
            paths={paths}
            providers={providers}
          />
        </div>

        <div className="mt-6 rounded-2xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] p-6 shadow-[0_18px_50px_rgba(4,10,24,0.24)]">
          <h2 className="mb-1 text-lg font-semibold text-[var(--workspace-shell-text)]">
            Integrations
          </h2>
          <p className="mb-4 text-sm text-[var(--workspace-shell-text-muted)]">
            Connect Google Calendar and Gmail once here. Planner and Email keep
            their own shortcuts too.
          </p>
          <Suspense fallback={<p className="text-sm text-[var(--workspace-shell-text-muted)]">Loading…</p>}>
            <PersonalIntegrationsSettingsSection />
          </Suspense>
          <div className="mt-4">
            <ConnectToClaudeSettingsSection />
          </div>
        </div>

        <div className="mt-6 rounded-2xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] p-6 shadow-[0_18px_50px_rgba(4,10,24,0.24)]">
          <h2 className="mb-1 text-lg font-semibold text-[var(--workspace-shell-text)]">
            Desktop recorder
          </h2>
          <p className="mb-4 text-sm text-[var(--workspace-shell-text-muted)]">
            Create API tokens and view usage limits in your personal settings.
          </p>
          <Suspense fallback={<p className="text-sm text-[var(--workspace-shell-text-muted)]">Loading…</p>}>
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
        </div>

        <div className="mt-6 rounded-2xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] p-6 shadow-[0_18px_50px_rgba(4,10,24,0.24)]">
          <Suspense fallback={<p className="text-sm text-[var(--workspace-shell-text-muted)]">Loading…</p>}>
            <KeelUsePreferencesSection />
          </Suspense>
        </div>

        <div className="mt-6 rounded-2xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] p-6 shadow-[0_18px_50px_rgba(4,10,24,0.24)]">
          <Suspense fallback={<p className="text-sm text-[var(--workspace-shell-text-muted)]">Loading…</p>}>
            <PersonalDashboardShortcutsSection />
          </Suspense>
        </div>
      </div>
    </PageBody>
  );
}

export default withI18n(PersonalAccountSettingsPage);
