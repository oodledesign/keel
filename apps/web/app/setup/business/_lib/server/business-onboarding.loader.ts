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
    return {
      user,
      account: null,
      clientId: null as string | null,
      client: null,
      taskTitle: null as string | null,
    };
  }

  const [{ data: client }, { data: task }] = await Promise.all([
    admin
      .from('clients')
      .select('id, company_name, website, picture_url, email')
      .eq('account_id', account.id)
      .is('archived_at', null)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle(),
    admin
      .from('tasks')
      .select('title')
      .eq('account_id', account.id)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle(),
  ]);

  const clientRow = client as {
    id?: string;
    company_name?: string | null;
    website?: string | null;
    picture_url?: string | null;
    email?: string | null;
  } | null;

  return {
    user,
    account,
    clientId: clientRow?.id ?? null,
    client: clientRow?.id
      ? {
          id: clientRow.id,
          name: clientRow.company_name ?? '',
          website: clientRow.website ?? null,
          pictureUrl: clientRow.picture_url ?? null,
          email: clientRow.email ?? null,
        }
      : null,
    taskTitle: (task as { title?: string } | null)?.title ?? null,
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
