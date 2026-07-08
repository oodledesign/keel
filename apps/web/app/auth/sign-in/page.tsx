import Link from 'next/link';

import { SignInMethodsContainer } from '@kit/auth/sign-in';
import { getSafeRedirectPath } from '@kit/shared/utils';
import { Button } from '@kit/ui/button';
import { Heading } from '@kit/ui/heading';
import { Trans } from '@kit/ui/trans';

import authConfig, { getSignInAuthProviders } from '~/config/auth.config';
import pathsConfig from '~/config/paths.config';
import { buildAuthLinkWithNext } from '~/lib/auth/signup-context';
import { createI18nServerInstance } from '~/lib/i18n/i18n.server';
import { withI18n } from '~/lib/i18n/with-i18n';

import { AuthFormCard } from '../_components/auth-form-card';

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
    <AuthFormCard>
      <div className="flex flex-col items-center gap-1 text-center">
        <Heading level={4} className="tracking-tight">
          <Trans i18nKey={'auth:signInHeading'} />
        </Heading>

        <p className="text-muted-foreground text-sm">
          <Trans i18nKey={'auth:signInSubheading'} />
        </p>
      </div>

      <SignInMethodsContainer
        paths={paths}
        providers={getSignInAuthProviders()}
        captchaSiteKey={authConfig.captchaTokenSiteKey}
      />

      <div className="flex justify-center">
        <Button asChild variant="link" size="sm">
          <Link
            href={buildAuthLinkWithNext(pathsConfig.auth.signUp, next)}
            prefetch={false}
          >
            <Trans i18nKey={'auth:doNotHaveAccountYet'} />
          </Link>
        </Button>
      </div>
    </AuthFormCard>
  );
}

export default withI18n(SignInPage);
