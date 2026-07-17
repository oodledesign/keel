import 'server-only';

import { cache } from 'react';

import { getSupabaseServerClient } from '@kit/supabase/server-client';

import pathsConfig from '~/config/paths.config';
import {
  resolveWorkspaceProfile,
  workspaceTypeLabel,
} from '~/home/[account]/_lib/workspace-profile';
import { findPlanByStripePriceId } from '~/lib/billing/ozer-plan-catalog';
import { requiredEntitlementForProfile } from '~/lib/billing/ozer-plan-catalog';

export type UserSubscriptionHubRow = {
  accountId: string;
  accountName: string;
  accountSlug: string;
  workspaceLabel: string;
  subscriptionStatus: string | null;
  planLabel: string | null;
  addons: string[];
  billingPath: string;
  role: string;
};

export const loadUserSubscriptionsHub = cache(
  async (userId: string): Promise<UserSubscriptionHubRow[]> => {
    const client = getSupabaseServerClient();

    const { data: memberships } = await client
      .from('accounts_memberships')
      .select(
        'account_role, account:accounts!inner(id, name, slug, space_type, is_personal_account)',
      )
      .eq('user_id', userId)
      .in('account_role', ['owner', 'admin']);

    const teamAccounts = (memberships ?? [])
      .map((row) => {
        const account = row.account as {
          id: string;
          name: string | null;
          slug: string | null;
          space_type: string | null;
          is_personal_account: boolean;
        };
        return {
          ...account,
          role: (row as { account_role?: string }).account_role ?? 'member',
        };
      })
      .filter((a) => !a.is_personal_account && a.slug);

    if (teamAccounts.length === 0) {
      return [];
    }

    const accountIds = teamAccounts.map((a) => a.id);

    const [businessTypes, subscriptions, entitlements] = await Promise.all([
      client
        .from('businesses')
        .select('account_id, type')
        .in('account_id', accountIds),
      client
        .from('subscriptions')
        .select('account_id, status, items: subscription_items(variant_id)')
        .in('account_id', accountIds),
      client
        .from('account_entitlements')
        .select('account_id, entitlement_key')
        .in('account_id', accountIds),
    ]);

    const businessTypeByAccount = new Map<string, string>();
    for (const row of businessTypes.data ?? []) {
      businessTypeByAccount.set(
        (row as { account_id: string }).account_id,
        String((row as { type?: string }).type ?? ''),
      );
    }

    const subsByAccount = new Map<
      string,
      Array<{ status: string; variantId: string | null }>
    >();
    for (const sub of subscriptions.data ?? []) {
      const accountId = (sub as { account_id: string }).account_id;
      const items =
        (sub as { items?: Array<{ variant_id?: string }> }).items ?? [];
      const list = subsByAccount.get(accountId) ?? [];
      list.push({
        status: String((sub as { status?: string }).status ?? ''),
        variantId: items[0]?.variant_id ?? null,
      });
      subsByAccount.set(accountId, list);
    }

    const entitlementsByAccount = new Map<string, string[]>();
    for (const row of entitlements.data ?? []) {
      const accountId = (row as { account_id: string }).account_id;
      const key = (row as { entitlement_key: string }).entitlement_key;
      const list = entitlementsByAccount.get(accountId) ?? [];
      list.push(key);
      entitlementsByAccount.set(accountId, list);
    }

    const addonLabels: Record<string, string> = {
      addon_signatures: 'Signatures',
      addon_rankly: 'Rankly',
      addon_feedflow: 'Feedflow',
      addon_videos: 'Videos',
    };

    return teamAccounts.map((account) => {
      const profile = resolveWorkspaceProfile({
        space_type: account.space_type,
        business_type: businessTypeByAccount.get(account.id) ?? null,
      });

      const subs = subsByAccount.get(account.id) ?? [];
      const activeSub = subs.find(
        (s) => s.status === 'active' || s.status === 'trialing',
      );

      const required = requiredEntitlementForProfile(profile);
      const accountEntitlements = entitlementsByAccount.get(account.id) ?? [];

      let planLabel: string | null = null;
      if (activeSub?.variantId) {
        const plan = findPlanByStripePriceId(activeSub.variantId);
        planLabel =
          plan?.productId.replace('keel-', '').replace(/-/g, ' ') ?? null;
      } else if (accountEntitlements.includes('workspace_business_lite')) {
        planLabel = 'Business Lite';
      }

      const addons = accountEntitlements
        .filter((k) => k.startsWith('addon_'))
        .map((k) => addonLabels[k] ?? k);

      const isFreeWorkspace = required === null;
      const hasEntitlement =
        required == null ||
        accountEntitlements.includes(required) ||
        (profile === 'work_design' &&
          accountEntitlements.includes('workspace_business_lite'));

      return {
        accountId: account.id,
        accountName: account.name ?? account.slug ?? 'Workspace',
        accountSlug: account.slug!,
        workspaceLabel: workspaceTypeLabel(profile),
        subscriptionStatus: isFreeWorkspace
          ? 'free'
          : (activeSub?.status ?? (hasEntitlement ? 'active' : null)),
        planLabel: isFreeWorkspace ? 'Free' : planLabel,
        addons,
        billingPath: pathsConfig.app.accountBilling.replace(
          '[account]',
          account.slug!,
        ),
        role: account.role,
      };
    });
  },
);
