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
  personalAccountId: string | null;
};

export type AdminUsersPageData =
  | {
      ok: true;
      users: AdminUserRow[];
      page: number;
      perPage: number;
      total: number;
    }
  | {
      ok: false;
      error: string;
      page: number;
      perPage: number;
    };

function parsePage(raw: string | undefined): number {
  if (!raw) {
    return 1;
  }

  const parsed = Number.parseInt(raw, 10);

  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

export const loadAdminUsersPage = cache(
  async (pageInput: number | string | undefined, query?: string): Promise<AdminUsersPageData> => {
    const page =
      typeof pageInput === 'number'
        ? Math.max(1, pageInput)
        : parsePage(pageInput);
    const perPage = 25;

    try {
      const admin = getSupabaseServerAdminClient();

      const { data, error } = await admin.auth.admin.listUsers({
        page,
        perPage,
      });

      if (error) {
        console.error('[admin-users] listUsers failed:', error.message);
        return {
          ok: false,
          error: error.message,
          page,
          perPage,
        };
      }

      const userIds = (data.users ?? []).map((user) => user.id);

      let personalAccountByUserId = new Map<string, string>();

      if (userIds.length > 0) {
        const { data: personalAccounts, error: accountsError } = await admin
          .from('accounts')
          .select('id, primary_owner_user_id')
          .in('primary_owner_user_id', userIds)
          .eq('is_personal_account', true);

        if (accountsError) {
          console.error('[admin-users] personal account lookup failed:', accountsError.message);
        } else {
          personalAccountByUserId = new Map(
            (personalAccounts ?? []).map((row) => [
              row.primary_owner_user_id as string,
              row.id as string,
            ]),
          );
        }
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
        personalAccountId: personalAccountByUserId.get(user.id) ?? user.id,
      }));

      if (query?.trim()) {
        const q = query.trim().toLowerCase();
        users = users.filter(
          (user) =>
            user.email?.toLowerCase().includes(q) ||
            user.id.toLowerCase().includes(q),
        );
      }

      return {
        ok: true,
        users,
        page,
        perPage,
        total: data.total ?? users.length,
      };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to load users.';

      console.error('[admin-users] unexpected failure:', message);

      return {
        ok: false,
        error: message,
        page,
        perPage,
      };
    }
  },
);
