'use client';

import Link from 'next/link';

import { PersonalAccountDropdown } from '@kit/accounts/personal-account-dropdown';
import { useSignOut } from '@kit/supabase/hooks/use-sign-out';
import { JWTUserData } from '@kit/supabase/types';
import { Button } from '@kit/ui/button';
import { Trans } from '@kit/ui/trans';

import { ThemeModeToggle } from '~/components/theme-mode-toggle';
import pathsConfig from '~/config/paths.config';
import { MARKETING_FREE_SIGNUP_URL } from '~/lib/billing/pricing-marketing';
import { docsUrl } from '~/lib/docs-url';

import { SiteMobileMarketingMenu } from './site-mobile-marketing-menu';

const paths = {
  home: pathsConfig.app.home,
  personalAccountSettings: pathsConfig.app.personalAccountSettings,
  personalAccountRewards: pathsConfig.app.personalAccountRewardsSettings,
  support: docsUrl(),
};

const features = {
  enableThemeToggle: false,
};

export function SiteHeaderAccountSection({
  user,
}: {
  user: JWTUserData | null;
}) {
  const signOut = useSignOut();

  if (user) {
    return (
      <div className="flex items-center gap-x-1">
        <ThemeModeToggle />
        <PersonalAccountDropdown
          showProfileName={false}
          paths={paths}
          features={features}
          user={user}
          signOutRequested={() => signOut.mutateAsync()}
        />
      </div>
    );
  }

  return <AuthButtons />;
}

const HEADER_SIGN_UP_CLASS =
  'h-9 rounded-[var(--ozer-radius-control)] bg-[var(--ozer-plum-950)] px-4 text-sm font-medium text-[var(--ozer-cream-50)] hover:bg-[var(--ozer-plum-800)] dark:bg-[var(--ozer-cream-50)] dark:text-[var(--ozer-plum-950)] dark:hover:bg-[var(--ozer-cream-100)]';

function AuthButtons() {
  return (
    <div className="animate-in fade-in flex items-center gap-x-2 duration-500">
      <ThemeModeToggle className="hidden md:inline-flex" />
      <div className="hidden items-center gap-x-5 md:flex">
        <Link
          href={pathsConfig.auth.signIn}
          className="text-sm font-medium text-[var(--workspace-shell-nav-text)] decoration-2 underline-offset-[10px] transition-colors duration-200 hover:text-[var(--workspace-shell-nav-text-hover)] hover:underline hover:decoration-[color:var(--ozer-plum-alpha-18)] dark:hover:decoration-[color:var(--ozer-on-dark-alpha-65)]"
        >
          <Trans i18nKey="auth:signIn" />
        </Link>

        <Button asChild size="sm" className={HEADER_SIGN_UP_CLASS}>
          <Link href={MARKETING_FREE_SIGNUP_URL}>
            <Trans i18nKey="auth:signUp" />
          </Link>
        </Button>
      </div>

      <div className="flex items-center gap-x-2 md:hidden">
        <Button asChild size="sm" className={HEADER_SIGN_UP_CLASS}>
          <Link href={MARKETING_FREE_SIGNUP_URL}>
            <Trans i18nKey="auth:signUp" />
          </Link>
        </Button>
        <SiteMobileMarketingMenu />
      </div>
    </div>
  );
}
