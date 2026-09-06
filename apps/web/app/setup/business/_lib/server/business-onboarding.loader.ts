import 'server-only';

import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

import { requireUserInServerComponent } from '~/lib/server/require-user-in-server-component';
import { fromAccountsUntyped } from '~/lib/supabase/accounts-table';

export async function loadBusinessOnboardingState(accountSlug?: string) {
  const user = await requireUserInServerComponent();
  const admin = getSupabaseServerAdminClient();

  let query = fromAccountsUntyped(admin)
    .select(
      'id, slug, name, picture_url, primary_owner_user_id, business_onboarding_step, business_onboarding_completed_at, space_type',
    )
    .eq('is_personal_account', false)
    .eq('primary_owner_user_id', user.id);

  if (accountSlug) {
    query = query.eq('slug', accountSlug);
  }

  const { data } = await query
    .order('created_at', { ascending: false })
    .limit(5);

  const account = (data ?? []).find((row: { space_type?: string | null }) => {
    const space = String(row.space_type ?? '');
    return space === 'work' || space === '';
  }) as
    | {
        id: string;
        slug: string;
        name: string;
        picture_url: string | null;
        business_onboarding_step: string | null;
        business_onboarding_completed_at: string | null;
      }
    | undefined;

  if (!account) {
    return { user, account: null, clientId: null as string | null };
  }

  const { data: client } = await admin
    .from('clients')
    .select('id')
    .eq('account_id', account.id)
    .is('archived_at', null)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  return {
    user,
    account,
    clientId: (client as { id?: string } | null)?.id ?? null,
  };
}

export async function findInProgressBusinessWorkspace(userId: string) {
  const admin = getSupabaseServerAdminClient();
  const { data } = await fromAccountsUntyped(admin)
    .select(
      'id, slug, name, picture_url, space_type, business_onboarding_step, business_onboarding_completed_at',
    )
    .eq('is_personal_account', false)
    .eq('primary_owner_user_id', userId)
    .order('created_at', { ascending: false })
    .limit(8);

  return (
    (data ?? []) as Array<{
      id: string;
      slug: string;
      name: string;
      picture_url: string | null;
      space_type?: string | null;
      business_onboarding_step: string | null;
      business_onboarding_completed_at: string | null;
    }>
  ).find((row) => {
    const space = String(row.space_type ?? '');
    const inProgress =
      Boolean(row.business_onboarding_step) &&
      row.business_onboarding_step !== 'done' &&
      !row.business_onboarding_completed_at;
    return (space === 'work' || space === '') && inProgress;
  });
}
