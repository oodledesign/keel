import 'server-only';

import { cache } from 'react';

import type { SupabaseClient } from '@supabase/supabase-js';

import { getSupabaseServerClient } from '@kit/supabase/server-client';

import { isTransientSupabaseError } from '~/lib/supabase/transient-errors';

export type UserTeamMembershipAccount = {
  id: string;
  name: string | null;
  slug: string | null;
  space_type: string | null;
  picture_url: string | null;
  created_at: string | null;
  is_personal_account: boolean | null;
  onboarding_completed: boolean | null;
};

/**
 * Single cached membership query shared by setup guard, switcher, and personal sidebar.
 */
export const loadUserTeamMemberships = cache(
  async (
    userId: string,
    client?: SupabaseClient,
  ): Promise<UserTeamMembershipAccount[]> => {
    const supabase = client ?? getSupabaseServerClient();

    const { data, error } = await supabase
      .from('accounts_memberships')
      .select(
        'onboarding_completed, account:accounts!inner(id, name, slug, space_type, picture_url, created_at, is_personal_account)',
      )
      .eq('user_id', userId);

    if (error) {
      if (isTransientSupabaseError(error)) {
        throw new Error(error.message);
      }
      console.error('[user-team-memberships] load:', error.message);
      return [];
    }

    type Row = {
      onboarding_completed?: boolean | null;
      account: UserTeamMembershipAccount | UserTeamMembershipAccount[] | null;
    };

    const out: UserTeamMembershipAccount[] = [];
    const seen = new Set<string>();

    for (const row of (data ?? []) as Row[]) {
      const acc = Array.isArray(row.account) ? row.account[0] : row.account;
      if (!acc?.id || acc.is_personal_account || seen.has(acc.id)) {
        continue;
      }

      seen.add(acc.id);
      out.push({
        ...acc,
        onboarding_completed: row.onboarding_completed ?? null,
      });
    }

    out.sort((left, right) =>
      (left.created_at ?? '').localeCompare(right.created_at ?? ''),
    );

    return out;
  },
);
