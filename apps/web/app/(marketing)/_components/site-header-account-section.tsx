'use client';

import Link from 'next/link';

import { PersonalAccountDropdown } from '@kit/accounts/personal-account-dropdown';
import { useSignOut } from '@kit/supabase/hooks/use-sign-out';
import { JWTUserData } from '@kit/supabase/types';
import { Button } from '@kit/ui/button';
import { Trans } from '@kit/ui/trans';

import pathsConfig from '~/config/paths.config';
import { MARKETING_FREE_SIGNUP_URL } from '~/lib/billing/pricing-marketing';

import { ThemeModeToggle } from '~/components/theme-mode-toggle';

import { SiteMobileMarketingMenu } from './site-mobile-marketing-menu';

const paths = {
  home: pathsConfig.app.home,
  personalAccountSettings: pathsConfig.app.personalAccountSettings,
  support: '/docs',
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

function AuthButtons() {
  return (
    <div className="animate-in fade-in flex items-center gap-x-2 duration-500">
      <ThemeModeToggle className="hidden md:inline-flex" />
      <div className="hidden items-center gap-x-2 md:flex">
        <Button asChild className="md:text-sm" variant="outline" size="sm">
          <Link href={pathsConfig.auth.signIn}>
            <Trans i18nKey="auth:signIn" />
          </Link>
        </Button>

        <Button asChild className="text-xs md:text-sm" variant="default" size="sm">
          <Link href={MARKETING_FREE_SIGNUP_URL}>
            <Trans i18nKey="auth:signUp" />
          </Link>
        </Button>
      </div>

      <div className="flex items-center gap-x-2 md:hidden">
        <Button asChild className="text-xs" variant="default" size="sm">
          <Link href={MARKETING_FREE_SIGNUP_URL}>
            <Trans i18nKey="auth:signUp" />
          </Link>
        </Button>
        <SiteMobileMarketingMenu />
      </div>
    </div>
  );
}
