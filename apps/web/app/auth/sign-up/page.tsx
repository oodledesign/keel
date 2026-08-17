import Link from 'next/link';

import { SignUpMethodsContainer } from '@kit/auth/sign-up';
import { getSafeRedirectPath } from '@kit/shared/utils';
import { Trans } from '@kit/ui/trans';

import authConfig, { getSignUpAuthProviders } from '~/config/auth.config';
import pathsConfig from '~/config/paths.config';
import {
  buildAuthLinkWithNext,
  isBusinessSignupIntent,
  resolveSignupContext,
} from '~/lib/auth/signup-context';
import { withI18n } from '~/lib/i18n/with-i18n';

import { AuthSplitShell } from '../_components/auth-split-shell';
import { BusinessSignUpFlow } from './_components/business-sign-up-flow';
import { CommercialSignUpFlow } from './_components/commercial-sign-up-flow';
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

  if (context.showPlanConfirm) {
    const flowProps = {
      initialContext: context,
      captchaSiteKey: authConfig.captchaTokenSiteKey,
      displayTermsCheckbox: authConfig.displayTermsCheckbox ?? false,
      providers: getSignUpAuthProviders(),
    };

    if (isBusinessSignupIntent(context.intent)) {
      return <BusinessSignUpFlow {...flowProps} />;
    }

    return <CommercialSignUpFlow {...flowProps} />;
  }

  const paths = {
    callback: pathsConfig.auth.callback,
    appHome: getSafeRedirectPath(next, pathsConfig.app.home),
  };

  return (
    <AuthSplitShell
      brandEyebrow={context.brandEyebrow}
      brandHeadline={context.brandHeadline}
      brandFooter={<SignupContextPanel context={context} />}
      formTitle={context.formTitle}
      formSubtitle={context.formSubtitle}
    >
      <SignUpMethodsContainer
        providers={getSignUpAuthProviders()}
        displayTermsCheckbox={authConfig.displayTermsCheckbox}
        paths={paths}
        captchaSiteKey={authConfig.captchaTokenSiteKey}
      />

      <p className="text-center text-sm text-[var(--workspace-shell-text-muted)]">
        <Trans i18nKey={'auth:alreadyHaveAnAccount'} />{' '}
        <Link
          href={buildAuthLinkWithNext(pathsConfig.auth.signIn, next)}
          prefetch={true}
          className="font-semibold text-[var(--ozer-accent)] hover:text-[var(--ozer-accent-hover)]"
        >
          Sign in
        </Link>
      </p>
    </AuthSplitShell>
  );
}

export default withI18n(SignUpPage);
