'use server';

import { getSupabaseServerClient } from '@kit/supabase/server-client';

export type PlatformSupportAccountOption = {
  id: string;
  label: string;
};

export async function loadPlatformSupportAccountOptions(): Promise<
  PlatformSupportAccountOption[]
> {
  const client = getSupabaseServerClient();
  const {
    data: { user },
  } = await client.auth.getUser();

  if (!user) {
    return [];
  }

  const { data: memberships } = await client
    .from('accounts_memberships')
    .select('account:accounts!inner(id, name, slug, is_personal_account)')
    .eq('user_id', user.id);

  return (memberships ?? [])
    .map((row) => {
      const account = row.account as {
        id: string;
        name: string | null;
        slug: string | null;
        is_personal_account: boolean;
      };

      if (account.is_personal_account) {
        return null;
      }

      return {
        id: account.id,
        label: account.name ?? account.slug ?? account.id,
      };
    })
    .filter(Boolean) as PlatformSupportAccountOption[];
}
