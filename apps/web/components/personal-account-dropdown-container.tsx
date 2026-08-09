'use client';

import { PersonalAccountDropdown } from '@kit/accounts/personal-account-dropdown';
import { useSignOut } from '@kit/supabase/hooks/use-sign-out';
import { useUser } from '@kit/supabase/hooks/use-user';
import { JWTUserData } from '@kit/supabase/types';

import { AiCreditsMenuMeter } from '~/components/ai/ai-credits-menu-meter';
import pathsConfig from '~/config/paths.config';
import { toHomeBillingHref } from '~/lib/ai/billing-href';

const paths = {
  home: pathsConfig.app.home,
  personalAccountSettings: pathsConfig.app.personalAccountSettings,
  support: pathsConfig.app.personalPlatformSupport,
};

const features = {
  enableThemeToggle: false,
};

export function ProfileAccountDropdownContainer(props: {
  user?: JWTUserData | null;
  showProfileName?: boolean;
  className?: string;

  account?: {
    id: string | null;
    name: string | null;
    picture_url: string | null;
  };

  /** Account whose AI credit pool to show (workspace or personal). */
  billingAccountId?: string;
  /** Billing settings href for the meter CTA. */
  billingHref?: string;
  /** When false, omit the AI credit meter (e.g. admin shell). */
  showAiCreditsMeter?: boolean;
}) {
  const signOut = useSignOut();
  const user = useUser(props.user);
  const userData = user.data;

  if (!userData) {
    return null;
  }

  const billingAccountId = props.billingAccountId ?? userData.id;
  const billingHref =
    props.billingHref ??
    toHomeBillingHref(pathsConfig.app.personalAccountBilling);
  const showMeter = props.showAiCreditsMeter !== false;

  return (
    <PersonalAccountDropdown
      className={props.className ?? 'w-full'}
      paths={paths}
      features={features}
      user={userData}
      account={props.account}
      signOutRequested={() => signOut.mutateAsync()}
      showProfileName={props.showProfileName}
      menuExtras={
        showMeter
          ? (open) => (
              <AiCreditsMenuMeter
                accountId={billingAccountId}
                billingHref={billingHref}
                active={open}
              />
            )
          : undefined
      }
    />
  );
}
