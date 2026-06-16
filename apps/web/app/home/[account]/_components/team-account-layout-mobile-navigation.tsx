'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { Home, LogOut, Menu } from 'lucide-react';

import { AccountSelector } from '@kit/accounts/account-selector';
import { useSignOut } from '@kit/supabase/hooks/use-sign-out';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@kit/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@kit/ui/dropdown-menu';
import { Trans } from '@kit/ui/trans';

import featureFlagsConfig from '~/config/feature-flags.config';
import pathsConfig from '~/config/paths.config';
import { getExplicitPersonalHomePath } from '~/lib/dashboard-shortcuts/personal-home-url';
import { getTeamAccountSidebarConfig } from '~/config/team-account-navigation.config';
import { flattenTeamNavLinks } from '~/home/[account]/_lib/flatten-team-nav-links';
import type { WorkspaceProfile } from '~/home/[account]/_lib/workspace-profile';
import type { WorkNavCounts } from '~/config/work-account-navigation.config';
import type { WorkspaceSwitcherAccount } from '~/home/_lib/server/workspace-switcher.loader';

type TeamAccountAccessSource = {
  permissions?: string[] | null;
  role?: string | null;
  company_role?: string | null;
};

const features = {
  enableTeamAccounts: featureFlagsConfig.enableTeamAccounts,
  enableTeamCreation: featureFlagsConfig.enableTeamCreation,
};

export const TeamAccountLayoutMobileNavigation = (
  props: React.PropsWithChildren<{
    account: string;
    userId: string;
    accounts: WorkspaceSwitcherAccount[];
    accountAccess?: TeamAccountAccessSource;
    moduleSettings?: Record<string, boolean>;
    workspaceProfile: WorkspaceProfile;
    navCounts?: WorkNavCounts;
  }>,
) => {
  const signOut = useSignOut();

  const Links = flattenTeamNavLinks(
    getTeamAccountSidebarConfig(
      props.account,
      props.accountAccess,
      props.moduleSettings,
      props.workspaceProfile,
      props.navCounts,
    ),
  ).map((item) => (
    <DropdownLink
      key={item.path}
      Icon={item.Icon}
      path={item.path}
      label={item.label}
    />
  ));

  return (
    <DropdownMenu>
      <DropdownMenuTrigger>
        <Menu className={'h-9'} />
      </DropdownMenuTrigger>

      <DropdownMenuContent
        sideOffset={10}
        className="max-h-[min(85vh,32rem)] w-screen overflow-y-auto rounded-none"
      >
        <TeamAccountsModal
          userId={props.userId}
          accounts={props.accounts}
          account={props.account}
        />

        {Links}

        <DropdownMenuSeparator />

        <SignOutDropdownItem onSignOut={() => signOut.mutateAsync()} />
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

function DropdownLink(
  props: React.PropsWithChildren<{
    path: string;
    label: string;
    Icon: React.ReactNode;
  }>,
) {
  return (
    <DropdownMenuItem asChild>
      <Link
        href={props.path}
        className={'flex h-12 w-full items-center gap-x-3 px-3'}
      >
        {props.Icon}

        <span>
          <Trans i18nKey={props.label} defaults={props.label} />
        </span>
      </Link>
    </DropdownMenuItem>
  );
}

function SignOutDropdownItem(
  props: React.PropsWithChildren<{
    onSignOut: () => unknown;
  }>,
) {
  return (
    <DropdownMenuItem
      className={'flex h-12 w-full items-center space-x-2'}
      onClick={props.onSignOut}
    >
      <LogOut className={'h-4'} />

      <span>
        <Trans i18nKey={'common:signOut'} />
      </span>
    </DropdownMenuItem>
  );
}

function TeamAccountsModal(props: {
  accounts: Accounts;
  userId: string;
  account: string;
}) {
  const router = useRouter();

  return (
    <Dialog>
      <DialogTrigger asChild>
        <DropdownMenuItem
          className={'flex h-12 w-full items-center space-x-2'}
          onSelect={(e) => e.preventDefault()}
        >
          <Home className={'h-4'} />

          <span>
            <Trans i18nKey={'common:yourAccounts'} />
          </span>
        </DropdownMenuItem>
      </DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            <Trans i18nKey={'common:yourAccounts'} />
          </DialogTitle>
        </DialogHeader>

        <div className={'py-6'}>
          <AccountSelector
            className={'w-full max-w-full'}
            collisionPadding={0}
            userId={props.userId}
            accounts={props.accounts}
            features={features}
            selectedAccount={props.account}
            onAccountChange={(value) => {
              const path = value
                ? pathsConfig.app.accountHome.replace('[account]', value)
                : getExplicitPersonalHomePath();

              router.replace(path);
            }}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
