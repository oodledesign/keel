import { redirect } from 'next/navigation';

import { getSupabaseServerClient } from '@kit/supabase/server-client';

import pathsConfig from '~/config/paths.config';
import { splitAuthDisplayName } from '~/lib/auth/split-auth-display-name';

import { BusinessOnboardingWizard } from './_components/business-onboarding-wizard';
import {
  type BusinessOnboardingStep,
  isBusinessOnboardingStep,
} from './_lib/business-onboarding-steps';
import { loadBusinessOnboardingState } from './_lib/server/business-onboarding.loader';

export const metadata = {
  title: 'Set up your business — Ozer',
};

export default async function BusinessOnboardingPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const accountSlug = typeof sp.account === 'string' ? sp.account : undefined;
  const { account, clientId, client, taskTitle, user } =
    await loadBusinessOnboardingState(accountSlug);

  const supabase = getSupabaseServerClient();
  const { data: settings } = await supabase
    .from('user_settings')
    .select('first_name, last_name')
    .eq('user_id', user.id)
    .maybeSingle();

  const userMeta = (user.user_metadata ?? {}) as Record<string, unknown>;
  const prefilledName = splitAuthDisplayName({
    firstName: (settings as { first_name?: string | null } | null)?.first_name,
    lastName: (settings as { last_name?: string | null } | null)?.last_name,
    givenName:
      typeof userMeta.given_name === 'string' ? userMeta.given_name : null,
    familyName:
      typeof userMeta.family_name === 'string' ? userMeta.family_name : null,
    fullName:
      typeof userMeta.full_name === 'string' ? userMeta.full_name : null,
    name: typeof userMeta.name === 'string' ? userMeta.name : null,
  });

  if (
    account &&
    (account.business_onboarding_completed_at ||
      !account.business_onboarding_step)
  ) {
    redirect(pathsConfig.app.accountHome.replace('[account]', account.slug));
  }

  const step: BusinessOnboardingStep = isBusinessOnboardingStep(
    account?.business_onboarding_step,
  )
    ? account.business_onboarding_step
    : 'company';

  return (
    <BusinessOnboardingWizard
      initialStep={step}
      account={
        account
          ? {
              id: account.id,
              slug: account.slug,
              name: account.name,
              picture_url: account.picture_url,
            }
          : null
      }
      clientId={clientId}
      client={client}
      taskTitle={taskTitle}
      userEmail={user.email ?? null}
      initialFirstName={prefilledName.firstName}
      initialLastName={prefilledName.lastName}
    />
  );
}
