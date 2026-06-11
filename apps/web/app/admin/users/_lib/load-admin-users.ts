import 'server-only';

import { cache } from 'react';

import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

export type AdminUserRow = {
  id: string;
  email: string | null;
  createdAt: string;
  lastSignInAt: string | null;
  banned: boolean;
  isSuperAdmin: boolean;
};

export const loadAdminUsersPage = cache(
  async (page: number, query?: string): Promise<{
    users: AdminUserRow[];
    page: number;
    perPage: number;
    total: number;
  }> => {
    const admin = getSupabaseServerAdminClient();
    const perPage = 25;

    const { data, error } = await admin.auth.admin.listUsers({
      page,
      perPage,
    });

    if (error) {
      throw error;
    }

    let users = (data.users ?? []).map((user) => ({
      id: user.id,
      email: user.email ?? null,
      createdAt: user.created_at,
      lastSignInAt: user.last_sign_in_at ?? null,
      banned:
        'banned_until' in user &&
        user.banned_until != null &&
        user.banned_until !== 'none',
      isSuperAdmin: user.app_metadata?.role === 'super-admin',
    }));

    if (query?.trim()) {
      const q = query.trim().toLowerCase();
      users = users.filter(
        (u) =>
          u.email?.toLowerCase().includes(q) || u.id.toLowerCase().includes(q),
      );
    }

    return {
      users,
      page,
      perPage,
      total: data.total ?? users.length,
    };
  },
);
