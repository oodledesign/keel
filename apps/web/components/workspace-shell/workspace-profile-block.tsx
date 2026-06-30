'use client';

import { useSignOut } from '@kit/supabase/hooks/use-sign-out';
import { JWTUserData } from '@kit/supabase/types';
import { cn } from '@kit/ui/utils';

import { PersonalAccountDropdown } from '@kit/accounts/personal-account-dropdown';
import { useUser } from '@kit/supabase/hooks/use-user';

import featureFlagsConfig from '~/config/feature-flags.config';
import pathsConfig from '~/config/paths.config';

const paths = {
  home: pathsConfig.app.home,
  personalAccountSettings: pathsConfig.app.personalAccountSettings,
  support: '/docs',
};

const features = {
  enableThemeToggle: false,
};

/**
 * Sidebar footer profile control: avatar, name, email, chevron.
 */
export function WorkspaceProfileBlock(props: {
  user: JWTUserData;
  account?: {
    id: string | null;
    name: string | null;
    picture_url: string | null;
  };
  collapsed?: boolean;
}) {
  const signOut = useSignOut();
  const userState = useUser(props.user);
  const user = userState.data;

  if (!user) {
    return null;
  }

  return (
    <PersonalAccountDropdown
      className={cn(
        'w-full gap-2.5 rounded-lg border border-solid border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] p-2.5 transition-colors hover:bg-[var(--workspace-shell-sidebar-accent)]',
        '[&_[data-test=account-dropdown-display-name]]:text-[var(--workspace-shell-text)]',
        '[&_[data-test=account-dropdown-email]]:text-[var(--workspace-shell-text)]/55',
        '[&_.text-muted-foreground]:text-[var(--workspace-shell-text)]/55',
        props.collapsed && 'justify-center border-0 bg-transparent p-0 hover:bg-[var(--workspace-shell-sidebar-accent)]',
      )}
      paths={paths}
      features={features}
      user={user}
      account={props.account}
      signOutRequested={() => signOut.mutateAsync()}
      showProfileName={!props.collapsed}
    />
  );
}
