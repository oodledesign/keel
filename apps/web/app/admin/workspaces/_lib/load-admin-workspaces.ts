import 'server-only';

import { cache } from 'react';

import { getSupabaseServerClient } from '@kit/supabase/server-client';

import {
  resolveWorkspaceProfile,
  workspaceTypeLabel,
} from '~/home/[account]/_lib/workspace-profile';

export type AdminWorkspaceRow = {
  id: string;
  name: string;
  slug: string;
  workspaceLabel: string;
  subscriptionStatus: string | null;
  billingExempt: boolean;
  entitlements: string[];
  createdAt: string;
};

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
    const client = getSupabaseServerClient();
    const page = Math.max(1, options.page);
    const pageSize = options.pageSize;
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    let queryBuilder = client
      .from('accounts')
      .select('id, name, slug, space_type, created_at', { count: 'exact' })
      .eq('is_personal_account', false)
      .order('created_at', { ascending: false })
      .range(from, to);

    if (options.query?.trim()) {
      const q = options.query.trim();
      queryBuilder = queryBuilder.or(
        `name.ilike.%${q}%,slug.ilike.%${q}%,email.ilike.%${q}%`,
      );
    }

    const { data: accounts, count, error } = await queryBuilder;

    if (error) {
      throw error;
    }

    const accountIds = (accounts ?? []).map((a) => a.id as string);

    if (accountIds.length === 0) {
      return {
        rows: [],
        page,
        pageSize,
        pageCount: Math.ceil((count ?? 0) / pageSize),
      };
    }

    const [businesses, subscriptions, entitlements, exempt] = await Promise.all([
      client.from('businesses').select('account_id, type').in('account_id', accountIds),
      client
        .from('subscriptions')
        .select('account_id, status')
        .in('account_id', accountIds),
      client
        .from('account_entitlements')
        .select('account_id, entitlement_key')
        .in('account_id', accountIds),
      client
        .from('account_billing_exempt')
        .select('account_id')
        .in('account_id', accountIds),
    ]);

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
      const profile = resolveWorkspaceProfile({
        space_type: account.space_type as string | null,
        business_type: bizByAccount.get(id) ?? null,
      });

      return {
        id,
        name: (account.name as string) ?? (account.slug as string),
        slug: account.slug as string,
        workspaceLabel: workspaceTypeLabel(profile),
        subscriptionStatus: subByAccount.get(id) ?? null,
        billingExempt: exemptSet.has(id),
        entitlements: entByAccount.get(id) ?? [],
        createdAt: account.created_at as string,
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
