import Link from 'next/link';

import { SignUpMethodsContainer } from '@kit/auth/sign-up';
import { getSafeRedirectPath } from '@kit/shared/utils';
import { Button } from '@kit/ui/button';
import { Trans } from '@kit/ui/trans';
import { cn } from '@kit/ui/utils';

import authConfig, { getSignUpAuthProviders } from '~/config/auth.config';
import pathsConfig from '~/config/paths.config';
import {
  buildAuthLinkWithNext,
  resolveSignupContext,
} from '~/lib/auth/signup-context';
import { withI18n } from '~/lib/i18n/with-i18n';
import {
  marketingEyebrowOnDark,
  marketingFeatureCard,
} from '~/lib/marketing/marketing-ui';

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
    <div className="w-full max-w-5xl">
      <div
        className={cn(
          'overflow-hidden rounded-3xl border border-[color:var(--ozer-border-on-light)] shadow-[0_24px_64px_var(--ozer-plum-alpha-18)]',
          'grid md:grid-cols-2',
        )}
      >
        {/* Brand / value column */}
        <aside className="relative flex flex-col justify-between gap-10 bg-[var(--ozer-plum-950)] px-8 py-10 text-[var(--ozer-text-on-dark)] md:px-10 md:py-12">
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.14]"
            style={{
              backgroundImage:
                'radial-gradient(ellipse 80% 60% at 20% 10%, var(--ozer-accent), transparent 55%), radial-gradient(ellipse 70% 50% at 90% 80%, color-mix(in srgb, var(--ozer-info) 70%, transparent), transparent 50%)',
            }}
            aria-hidden
          />
          <div className="relative space-y-5">
            <span className={marketingEyebrowOnDark}>Ozer</span>
            <h1 className="font-heading text-3xl font-bold tracking-tight text-[var(--ozer-text-on-dark)] md:text-4xl">
              {context.heading}
            </h1>
            <p className="max-w-md text-base leading-relaxed text-[var(--ozer-text-on-dark-muted)]">
              {context.subheading}
            </p>
          </div>
          <SignupContextPanel context={context} className="relative" />
        </aside>

        {/* Form column */}
        <div
          className={cn(
            'flex flex-col justify-center gap-6 bg-[var(--ozer-white)] px-6 py-8 md:px-10 md:py-12',
            marketingFeatureCard,
            'rounded-none border-0',
          )}
        >
          <div className="space-y-1 md:hidden">
            <h2 className="font-heading text-xl font-bold tracking-tight text-[var(--workspace-shell-text)]">
              Sign up
            </h2>
            <p className="text-sm text-[var(--workspace-shell-text-muted)]">
              No card required to start.
            </p>
          </div>

          <SignUpMethodsContainer
            providers={getSignUpAuthProviders()}
            displayTermsCheckbox={authConfig.displayTermsCheckbox}
            paths={paths}
            captchaSiteKey={authConfig.captchaTokenSiteKey}
          />

          <div className="flex justify-center">
            <Button asChild variant="link" size="sm" className="text-[var(--workspace-shell-text-muted)]">
              <Link
                href={buildAuthLinkWithNext(pathsConfig.auth.signIn, next)}
                prefetch={true}
              >
                <Trans i18nKey={'auth:alreadyHaveAnAccount'} />
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default withI18n(SignUpPage);
