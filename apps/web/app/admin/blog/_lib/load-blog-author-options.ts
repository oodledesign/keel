import 'server-only';

import { cache } from 'react';

import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

import { requireSuperAdmin } from '~/admin/_lib/server/require-super-admin';

export type BlogAuthorOption = {
  userId: string;
  name: string;
  email: string | null;
  avatarUrl: string | null;
};

export const loadBlogAuthorOptions = cache(async (): Promise<BlogAuthorOption[]> => {
  await requireSuperAdmin();

  const admin = getSupabaseServerAdminClient();
  const superAdmins: Array<{
    id: string;
    email: string | null;
  }> = [];

  let page = 1;

  while (true) {
    const { data, error } = await admin.auth.admin.listUsers({
      page,
      perPage: 100,
    });

    if (error) {
      console.error('[blog-authors] listUsers failed:', error.message);
      break;
    }

    for (const user of data.users ?? []) {
      if (user.app_metadata?.role === 'super-admin') {
        superAdmins.push({
          id: user.id,
          email: user.email ?? null,
        });
      }
    }

    if ((data.users ?? []).length < 100) {
      break;
    }

    page += 1;
  }

  if (superAdmins.length === 0) {
    return [];
  }

  const userIds = superAdmins.map((user) => user.id);

  const { data: personalAccounts, error: accountsError } = await admin
    .from('accounts')
    .select('primary_owner_user_id, name, picture_url')
    .in('primary_owner_user_id', userIds)
    .eq('is_personal_account', true);

  if (accountsError) {
    console.error('[blog-authors] account lookup failed:', accountsError.message);
  }

  const accountByUserId = new Map(
    (personalAccounts ?? []).map((row) => [
      row.primary_owner_user_id as string,
      {
        name: row.name as string,
        avatarUrl: (row.picture_url as string | null) ?? null,
      },
    ]),
  );

  return superAdmins
    .map((user) => {
      const account = accountByUserId.get(user.id);

      return {
        userId: user.id,
        name: account?.name ?? user.email?.split('@')[0] ?? 'Author',
        email: user.email,
        avatarUrl: account?.avatarUrl ?? null,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
});
