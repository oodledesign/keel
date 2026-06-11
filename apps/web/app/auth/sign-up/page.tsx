import Link from 'next/link';

import { SignUpMethodsContainer } from '@kit/auth/sign-up';
import { getSafeRedirectPath } from '@kit/shared/utils';
import { Button } from '@kit/ui/button';
import { Heading } from '@kit/ui/heading';
import { Trans } from '@kit/ui/trans';

import authConfig from '~/config/auth.config';
import pathsConfig from '~/config/paths.config';
import { createI18nServerInstance } from '~/lib/i18n/i18n.server';
import { withI18n } from '~/lib/i18n/with-i18n';

interface SignUpPageProps {
  searchParams: Promise<{
    next?: string;
  }>;
}

export const generateMetadata = async () => {
  const i18n = await createI18nServerInstance();

  return {
    title: i18n.t('auth:signUp'),
  };
};

async function SignUpPage({ searchParams }: SignUpPageProps) {
  const { next } = await searchParams;

  const paths = {
    callback: pathsConfig.auth.callback,
    appHome: getSafeRedirectPath(next, pathsConfig.app.home),
  };

  return (
    <>
      <div className={'flex flex-col items-center gap-1'}>
        <Heading level={4} className={'tracking-tight'}>
          <Trans i18nKey={'auth:signUpHeading'} />
        </Heading>

        <p className={'text-muted-foreground text-sm'}>
          <Trans i18nKey={'auth:signUpSubheading'} />
        </p>
      </div>

      <SignUpMethodsContainer
        providers={authConfig.providers}
        displayTermsCheckbox={authConfig.displayTermsCheckbox}
        paths={paths}
        captchaSiteKey={authConfig.captchaTokenSiteKey}
      />

      <div className={'flex justify-center'}>
        <Button asChild variant={'link'} size={'sm'}>
          <Link href={pathsConfig.auth.signIn} prefetch={true}>
            <Trans i18nKey={'auth:alreadyHaveAnAccount'} />
          </Link>
        </Button>
      </div>
    </>
  );
}

export default withI18n(SignUpPage);
