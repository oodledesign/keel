import 'server-only';

import { cache } from 'react';

import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

import {
  resolveWorkspaceProfile,
  workspaceTypeLabel,
} from '~/home/[account]/_lib/workspace-profile';

export type AdminWorkspaceRow = {
  id: string;
  name: string;
  slug: string;
  workspaceLabel: string;
  ownerEmail: string | null;
  subscriptionStatus: string | null;
  billingExempt: boolean;
  entitlements: string[];
  createdAt: string | null;
};

function sanitizeFilterValue(value: string) {
  return value.replace(/[%(),]/g, ' ').trim();
}

/**
 * Resolve team account IDs linked to an email (owner, member, or pending invite).
 */
async function findTeamAccountIdsByEmail(
  admin: ReturnType<typeof getSupabaseServerAdminClient>,
  query: string,
): Promise<string[]> {
  const pattern = `%${sanitizeFilterValue(query)}%`;

  const [
    { data: personalAccounts, error: personalError },
    { data: invitations, error: inviteError },
  ] = await Promise.all([
    admin
      .from('accounts')
      .select('primary_owner_user_id')
      .eq('is_personal_account', true)
      .ilike('email', pattern),
    admin.from('invitations').select('account_id').ilike('email', pattern),
  ]);

  if (personalError ?? inviteError) {
    throw personalError ?? inviteError;
  }

  const userIds = [
    ...new Set(
      (personalAccounts ?? [])
        .map((row) => row.primary_owner_user_id as string | null)
        .filter((id): id is string => Boolean(id)),
    ),
  ];

  const accountIds = new Set<string>();

  for (const row of invitations ?? []) {
    if (row.account_id) {
      accountIds.add(row.account_id as string);
    }
  }

  if (userIds.length === 0) {
    return [...accountIds];
  }

  const [
    { data: ownedTeams, error: ownedError },
    { data: memberships, error: membershipError },
  ] = await Promise.all([
    admin
      .from('accounts')
      .select('id')
      .eq('is_personal_account', false)
      .in('primary_owner_user_id', userIds),
    admin
      .from('accounts_memberships')
      .select('account_id')
      .in('user_id', userIds),
  ]);

  if (ownedError ?? membershipError) {
    throw ownedError ?? membershipError;
  }

  for (const row of ownedTeams ?? []) {
    accountIds.add(row.id as string);
  }

  for (const row of memberships ?? []) {
    accountIds.add(row.account_id as string);
  }

  return [...accountIds];
}

export const loadAdminWorkspacesPage = cache(
  async (options: {
    page: number;
    pageSize: number;
    query?: string;
  }): Promise<{
    rows: AdminWorkspaceRow[];
    page: number;
    pageSize: number;
    pageCount: number;
  }> => {
    const admin = getSupabaseServerAdminClient();
    const page = Math.max(1, options.page);
    const pageSize = options.pageSize;
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    const rawQuery = options.query?.trim() ?? '';
    const q = sanitizeFilterValue(rawQuery);

    let queryBuilder = admin
      .from('accounts')
      .select('id, name, slug, space_type, created_at, primary_owner_user_id', {
        count: 'exact',
      })
      .eq('is_personal_account', false)
      .order('created_at', { ascending: false })
      .range(from, to);

    if (q) {
      const emailMatchedIds = await findTeamAccountIdsByEmail(admin, q);
      const textFilters = `name.ilike.%${q}%,slug.ilike.%${q}%`;

      if (emailMatchedIds.length > 0) {
        queryBuilder = queryBuilder.or(
          `${textFilters},id.in.(${emailMatchedIds.join(',')})`,
        );
      } else {
        queryBuilder = queryBuilder.or(textFilters);
      }
    }

    const { data: accounts, count, error } = await queryBuilder;

    if (error) {
      throw error;
    }

    const accountIds = (accounts ?? []).map((a) => a.id as string);
    const ownerUserIds = [
      ...new Set(
        (accounts ?? [])
          .map((a) => a.primary_owner_user_id as string | null)
          .filter((id): id is string => Boolean(id)),
      ),
    ];

    if (accountIds.length === 0) {
      return {
        rows: [],
        page,
        pageSize,
        pageCount: Math.ceil((count ?? 0) / pageSize),
      };
    }

    const [businesses, subscriptions, entitlements, exempt, ownerAccounts] =
      await Promise.all([
        admin
          .from('businesses')
          .select('account_id, type')
          .in('account_id', accountIds),
        admin
          .from('subscriptions')
          .select('account_id, status')
          .in('account_id', accountIds),
        admin
          .from('account_entitlements')
          .select('account_id, entitlement_key')
          .in('account_id', accountIds),
        admin
          .from('account_billing_exempt')
          .select('account_id')
          .in('account_id', accountIds),
        ownerUserIds.length > 0
          ? admin
              .from('accounts')
              .select('primary_owner_user_id, email')
              .eq('is_personal_account', true)
              .in('primary_owner_user_id', ownerUserIds)
          : Promise.resolve({ data: [] as { primary_owner_user_id: string; email: string | null }[] }),
      ]);

    const ownerEmailByUserId = new Map<string, string | null>();
    for (const row of ownerAccounts.data ?? []) {
      ownerEmailByUserId.set(
        row.primary_owner_user_id as string,
        (row.email as string | null) ?? null,
      );
    }

    const bizByAccount = new Map<string, string>();
    for (const row of businesses.data ?? []) {
      bizByAccount.set(
        (row as { account_id: string }).account_id,
        String((row as { type?: string }).type ?? ''),
      );
    }

    const subByAccount = new Map<string, string>();
    for (const row of subscriptions.data ?? []) {
      subByAccount.set(
        (row as { account_id: string }).account_id,
        String((row as { status?: string }).status ?? ''),
      );
    }

    const entByAccount = new Map<string, string[]>();
    for (const row of entitlements.data ?? []) {
      const accountId = (row as { account_id: string }).account_id;
      const key = (row as { entitlement_key: string }).entitlement_key;
      const list = entByAccount.get(accountId) ?? [];
      list.push(key);
      entByAccount.set(accountId, list);
    }

    const exemptSet = new Set(
      (exempt.data ?? []).map((r) => (r as { account_id: string }).account_id),
    );

    const rows: AdminWorkspaceRow[] = (accounts ?? []).map((account) => {
      const id = account.id as string;
      const ownerUserId = account.primary_owner_user_id as string | null;
      const profile = resolveWorkspaceProfile({
        space_type: account.space_type as string | null,
        business_type: bizByAccount.get(id) ?? null,
      });

      return {
        id,
        name: (account.name as string) ?? (account.slug as string),
        slug: account.slug as string,
        workspaceLabel: workspaceTypeLabel(profile),
        ownerEmail: ownerUserId
          ? (ownerEmailByUserId.get(ownerUserId) ?? null)
          : null,
        subscriptionStatus: subByAccount.get(id) ?? null,
        billingExempt: exemptSet.has(id),
        entitlements: entByAccount.get(id) ?? [],
        createdAt: (account.created_at as string | null) ?? null,
      };
    });

    return {
      rows,
      page,
      pageSize,
      pageCount: Math.ceil((count ?? 0) / pageSize),
    };
  },
);
