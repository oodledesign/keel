'use client';

import { PersonalAccountDropdown } from '@kit/accounts/personal-account-dropdown';
import { useSignOut } from '@kit/supabase/hooks/use-sign-out';
import { useUser } from '@kit/supabase/hooks/use-user';
import { JWTUserData } from '@kit/supabase/types';
import { cn } from '@kit/ui/utils';

import { AiCreditsMenuMeter } from '~/components/ai/ai-credits-menu-meter';
import { useOptionalWorkspaceOooDialog } from '~/components/workspace-shell/workspace-ooo-dialog-context';
import pathsConfig from '~/config/paths.config';
import { toHomeBillingHref } from '~/lib/ai/billing-href';
import { docsUrl } from '~/lib/docs-url';

const paths = {
  home: pathsConfig.app.home,
  personalAccountSettings: pathsConfig.app.personalAccountSettings,
  personalAccountRewards: pathsConfig.app.personalAccountRewardsSettings,
  support: docsUrl(),
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
  billingAccountId?: string;
  billingHref?: string;
}) {
  const signOut = useSignOut();
  const userState = useUser(props.user);
  const user = userState.data;
  const oooDialog = useOptionalWorkspaceOooDialog();

  if (!user) {
    return null;
  }

  const billingAccountId = props.billingAccountId ?? user.id;
  const billingHref =
    props.billingHref ??
    toHomeBillingHref(pathsConfig.app.personalAccountBilling);

  return (
    <PersonalAccountDropdown
      className={cn(
        'w-full gap-2.5 rounded-lg border border-solid border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] p-2.5 transition-colors hover:bg-[var(--workspace-shell-sidebar-accent)]',
        props.collapsed &&
          'justify-center border-0 bg-transparent p-0 hover:bg-[var(--workspace-shell-sidebar-accent)]',
      )}
      paths={paths}
      features={features}
      user={user}
      account={props.account}
      signOutRequested={() => signOut.mutateAsync()}
      showProfileName={!props.collapsed}
      onOutOfOfficeClick={
        oooDialog
          ? () => oooDialog.openOooDialog(props.billingAccountId ?? null)
          : undefined
      }
      menuExtras={(open) => (
        <AiCreditsMenuMeter
          accountId={billingAccountId}
          billingHref={billingHref}
          active={open}
        />
      )}
    />
  );
}
