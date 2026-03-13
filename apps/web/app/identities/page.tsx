import { Metadata } from 'next';

import { redirect } from 'next/navigation';

import { AuthLayoutShell } from '@kit/auth/shared';
import { getSafeRedirectPath } from '@kit/shared/utils';
import { requireUser } from '@kit/supabase/require-user';
import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { Heading } from '@kit/ui/heading';
import { Trans } from '@kit/ui/trans';

import { AppLogo } from '~/components/app-logo';
import authConfig from '~/config/auth.config';
import pathsConfig from '~/config/paths.config';
import { createI18nServerInstance } from '~/lib/i18n/i18n.server';
import { withI18n } from '~/lib/i18n/with-i18n';

import { IdentitiesStepWrapper } from './_components/identities-step-wrapper';

export const meta = async (): Promise<Metadata> => {
  const i18n = await createI18nServerInstance();

  return {
    title: i18n.t('auth:setupAccount'),
  };
};

type IdentitiesPageProps = {
  searchParams: Promise<{ next?: string; require_auth_method?: string }>;
};

/**
 * @name IdentitiesPage
 * @description Displays linked accounts and available authentication methods.
 */
async function IdentitiesPage(props: IdentitiesPageProps) {
  const {
    nextPath,
    showPasswordOption,
    showEmailOption,
    showMagicLinkOption,
    oAuthProviders,
    enableIdentityLinking,
    requiresConfirmation,
    requireMethodSelection,
  } = await fetchData(props);

  return (
    <AuthLayoutShell
      Logo={AppLogo}
      contentClassName="max-w-md overflow-y-hidden"
    >
      <div
        className={
          'flex max-h-[70vh] w-full flex-col items-center space-y-6 overflow-y-auto'
        }
      >
        <div className={'flex flex-col items-center gap-1'}>
          <Heading
            level={4}
            className="text-center"
            data-test="identities-page-heading"
          >
            <Trans i18nKey={'auth:linkAccountToSignIn'} />
          </Heading>

          <Heading
            level={6}
            className={'text-muted-foreground text-center text-sm'}
            data-test="identities-page-description"
          >
            <Trans i18nKey={'auth:linkAccountToSignInDescription'} />
          </Heading>
        </div>

        <IdentitiesStepWrapper
          nextPath={nextPath}
          showPasswordOption={showPasswordOption}
          showEmailOption={showEmailOption}
          showMagicLinkOption={showMagicLinkOption}
          oAuthProviders={oAuthProviders}
          enableIdentityLinking={enableIdentityLinking}
          requiresConfirmation={requiresConfirmation}
          requireMethodSelection={requireMethodSelection}
        />
      </div>
    </AuthLayoutShell>
  );
}

export default withI18n(IdentitiesPage);

async function fetchData(props: IdentitiesPageProps) {
  const searchParams = await props.searchParams;
  const client = getSupabaseServerClient();
  const auth = await requireUser(client);

  // If not authenticated, redirect to sign in
  if (!auth.data) {
    throw redirect(pathsConfig.auth.signIn);
  }

  // Get the next path from URL params (where to redirect after setup)
  const nextPath = getSafeRedirectPath(searchParams.next, pathsConfig.app.home);
  const requireMethodSelection =
    searchParams.require_auth_method === 'true';

  // Available auth methods to add
  const showPasswordOption = authConfig.providers.password;
  const showMagicLinkOption = authConfig.providers.magicLink;

  // Show email option if password, magic link, or OTP is enabled
  const showEmailOption =
    authConfig.providers.password ||
    authConfig.providers.magicLink ||
    authConfig.providers.otp;

  const oAuthProviders = authConfig.providers.oAuth;
  const enableIdentityLinking = authConfig.enableIdentityLinking;

  // Only require confirmation if password or oauth providers are enabled
  const requiresConfirmation =
    authConfig.providers.password || oAuthProviders.length > 0;

  return {
    nextPath,
    showPasswordOption,
    showEmailOption,
    showMagicLinkOption,
    oAuthProviders,
    enableIdentityLinking,
    requiresConfirmation,
    requireMethodSelection,
  };
}
