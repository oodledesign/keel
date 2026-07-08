import Link from 'next/link';

import { SignUpMethodsContainer } from '@kit/auth/sign-up';
import { getSafeRedirectPath } from '@kit/shared/utils';
import { Button } from '@kit/ui/button';
import { Heading } from '@kit/ui/heading';
import { Trans } from '@kit/ui/trans';

import authConfig, { getSignUpAuthProviders } from '~/config/auth.config';
import pathsConfig from '~/config/paths.config';
import {
  buildAuthLinkWithNext,
  resolveSignupContext,
} from '~/lib/auth/signup-context';
import { withI18n } from '~/lib/i18n/with-i18n';

import { SignupContextPanel } from './_components/signup-context-panel';

interface SignUpPageProps {
  searchParams: Promise<{
    next?: string;
  }>;
}

export const generateMetadata = async ({ searchParams }: SignUpPageProps) => {
  const { next } = await searchParams;
  const context = resolveSignupContext(next);

  return {
    title: context.heading,
  };
};

async function SignUpPage({ searchParams }: SignUpPageProps) {
  const { next } = await searchParams;
  const context = resolveSignupContext(next);

  const paths = {
    callback: pathsConfig.auth.callback,
    appHome: getSafeRedirectPath(next, pathsConfig.app.home),
  };

  return (
    <>
      <div className={'flex flex-col items-center gap-1 text-center'}>
        <Heading level={4} className={'tracking-tight'}>
          {context.heading}
        </Heading>

        <p className={'text-muted-foreground text-sm leading-relaxed'}>
          {context.subheading}
        </p>
      </div>

      <SignupContextPanel context={context} />

      <SignUpMethodsContainer
        providers={getSignUpAuthProviders()}
        displayTermsCheckbox={authConfig.displayTermsCheckbox}
        paths={paths}
        captchaSiteKey={authConfig.captchaTokenSiteKey}
      />

      <div className={'flex justify-center'}>
        <Button asChild variant={'link'} size={'sm'}>
          <Link
            href={buildAuthLinkWithNext(pathsConfig.auth.signIn, next)}
            prefetch={true}
          >
            <Trans i18nKey={'auth:alreadyHaveAnAccount'} />
          </Link>
        </Button>
      </div>
    </>
  );
}

export default withI18n(SignUpPage);
