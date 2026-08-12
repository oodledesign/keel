import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import {
  type CommercialSeatKind,
  freeSupportSeats,
  maxMembersForBillableSeats,
  portalPublishingAllowed,
} from '~/lib/billing/commercial-graduated-pricing';

/**
 * Commercial Property seat access helpers.
 * Support seats: view + notes/activity; cannot mutate stages, disposals, or publishing.
 */

export async function getMembershipSeatKind(
  client: SupabaseClient,
  accountId: string,
  userId: string,
): Promise<CommercialSeatKind> {
  const { data } = await client
    .from('accounts_memberships')
    .select('seat_kind')
    .eq('account_id', accountId)
    .eq('user_id', userId)
    .maybeSingle();

  const kind = (data as { seat_kind?: string | null } | null)?.seat_kind;
  return kind === 'support' ? 'support' : 'billable';
}

export async function assertCommercialBillableMember(params: {
  client: SupabaseClient;
  accountId: string;
  userId: string;
  action: string;
}): Promise<void> {
  const kind = await getMembershipSeatKind(
    params.client,
    params.accountId,
    params.userId,
  );

  if (kind === 'support') {
    throw new Error(
      `Support seats cannot ${params.action}. Ask a billable team member, or upgrade this seat.`,
    );
  }
}

export async function getCommercialBillableSeatCount(
  client: SupabaseClient,
  accountId: string,
): Promise<number> {
  const { data: sub } = await client
    .from('subscriptions')
    .select(
      `
      id,
      status,
      subscription_items (
        quantity,
        type
      )
    `,
    )
    .eq('account_id', accountId)
    .maybeSingle();

  const items =
    (
      sub as {
        subscription_items?: Array<{ quantity?: number; type?: string }>;
      } | null
    )?.subscription_items ?? [];

  const perSeat = items.find((item) => item.type === 'per_seat');
  if (perSeat?.quantity && perSeat.quantity > 0) {
    return perSeat.quantity;
  }

  const { count } = await client
    .from('accounts_memberships')
    .select('*', { count: 'exact', head: true })
    .eq('account_id', accountId)
    .filter('seat_kind', 'eq', 'billable');

  return Math.max(1, count ?? 1);
}

export async function assertCommercialPortalPublishingAllowed(params: {
  client: SupabaseClient;
  accountId: string;
}): Promise<void> {
  const billable = await getCommercialBillableSeatCount(
    params.client,
    params.accountId,
  );

  if (!portalPublishingAllowed(billable)) {
    throw new Error(
      'Portal publishing is not available on this subscription. Check your commercial plan seats.',
    );
  }
}

export async function getCommercialSeatBreakdown(
  client: SupabaseClient,
  accountId: string,
) {
  const [billableMembers, supportMembers, billableInvites, supportInvites] =
    await Promise.all([
      client
        .from('accounts_memberships')
        .select('*', { count: 'exact', head: true })
        .eq('account_id', accountId)
        .filter('seat_kind', 'eq', 'billable'),
      client
        .from('accounts_memberships')
        .select('*', { count: 'exact', head: true })
        .eq('account_id', accountId)
        .filter('seat_kind', 'eq', 'support'),
      client
        .from('invitations')
        .select('*', { count: 'exact', head: true })
        .eq('account_id', accountId)
        .filter('seat_kind', 'eq', 'billable'),
      client
        .from('invitations')
        .select('*', { count: 'exact', head: true })
        .eq('account_id', accountId)
        .filter('seat_kind', 'eq', 'support'),
    ]);

  const billableCount =
    (billableMembers.count ?? 0) + (billableInvites.count ?? 0);
  const supportCount =
    (supportMembers.count ?? 0) + (supportInvites.count ?? 0);
  const subscribedBillable = await getCommercialBillableSeatCount(
    client,
    accountId,
  );
  const supportAllowance = freeSupportSeats(subscribedBillable);

  return {
    billableCount,
    supportCount,
    subscribedBillable,
    supportAllowance,
    maxMembers: maxMembersForBillableSeats(subscribedBillable),
  };
}
