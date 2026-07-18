import Link from 'next/link';

import { SignInMethodsContainer } from '@kit/auth/sign-in';
import { getSafeRedirectPath } from '@kit/shared/utils';
import { Trans } from '@kit/ui/trans';

import authConfig, { getSignInAuthProviders } from '~/config/auth.config';
import pathsConfig from '~/config/paths.config';
import { buildAuthLinkWithNext } from '~/lib/auth/signup-context';
import { createI18nServerInstance } from '~/lib/i18n/i18n.server';
import { withI18n } from '~/lib/i18n/with-i18n';

import { AuthSplitShell } from '../_components/auth-split-shell';

interface SignInPageProps {
  searchParams: Promise<{
    next?: string;
  }>;
}

export const generateMetadata = async () => {
  const i18n = await createI18nServerInstance();

  return {
    title: i18n.t('auth:signIn'),
  };
};

async function SignInPage({ searchParams }: SignInPageProps) {
  const { next } = await searchParams;

  const paths = {
    callback: pathsConfig.auth.callback,
    returnPath: getSafeRedirectPath(next, pathsConfig.app.home),
    joinTeam: pathsConfig.app.joinTeam,
  };

  return (
    <AuthSplitShell
      brandHeadline="Pick up where you left off — studio, life, and plans in one home."
      formTitle="Welcome back"
      formSubtitle="Sign in to your personal hub and every workspace connected to it."
    >
      <SignInMethodsContainer
        paths={paths}
        providers={getSignInAuthProviders()}
        captchaSiteKey={authConfig.captchaTokenSiteKey}
      />

      <p className="text-center text-sm text-[var(--workspace-shell-text-muted)]">
        <Trans i18nKey={'auth:doNotHaveAccountYet'} />{' '}
        <Link
          href={buildAuthLinkWithNext(pathsConfig.auth.signUp, next)}
          prefetch={false}
          className="font-semibold text-[var(--ozer-accent)] hover:text-[var(--ozer-accent-hover)]"
        >
          Create an account
        </Link>
      </p>
    </AuthSplitShell>
  );
}

export default withI18n(SignInPage);
