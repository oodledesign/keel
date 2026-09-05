import { redirect } from 'next/navigation';

import { getSupabaseServerClient } from '@kit/supabase/server-client';

import pathsConfig from '~/config/paths.config';
import { requireUserInServerComponent } from '~/lib/server/require-user-in-server-component';

import { BusinessOnboardingWizard } from './_components/business-onboarding-wizard';
import {
  type BusinessOnboardingStep,
  isBusinessOnboardingStep,
} from './_lib/business-onboarding-steps';
import { loadBusinessOnboardingState } from './_lib/server/business-onboarding.actions';

export const metadata = {
  title: 'Set up your business — Ozer',
};

export default async function BusinessOnboardingPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireUserInServerComponent();
  const sp = await searchParams;
  const accountSlug = typeof sp.account === 'string' ? sp.account : undefined;
  const { account, clientId, user } =
    await loadBusinessOnboardingState(accountSlug);

  const client = getSupabaseServerClient();
  const { data: settings } = await client
    .from('user_settings')
    .select('first_name, last_name')
    .eq('user_id', user.id)
    .maybeSingle();

  const metadata = user.user_metadata as
    | { full_name?: string; name?: string }
    | undefined;
  const userNeedsName = !(
    (settings as { first_name?: string | null } | null)?.first_name?.trim() ||
    metadata?.full_name ||
    metadata?.name
  );

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
      userNeedsName={userNeedsName}
    />
  );
}
