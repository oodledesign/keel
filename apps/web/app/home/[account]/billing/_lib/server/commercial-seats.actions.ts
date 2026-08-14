'use server';

import { revalidatePath } from 'next/cache';

import { enhanceAction } from '@kit/next/actions';
import { requireUser } from '@kit/supabase/require-user';
import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { createTeamAccountsApi } from '@kit/team-accounts/api';
import { createAccountPerSeatBillingService } from '@kit/team-accounts/billing';

import { getTeamAccountAccess } from '~/home/[account]/_lib/role-access';
import { maxMembersForBillableSeats } from '~/lib/billing/commercial-graduated-pricing';
import { getCommercialSeatBreakdown } from '~/lib/commercial/commercial-seat-access';

import { UpdateCommercialSeatQuantitySchema } from '../schema/commercial-seats.schema';

export const updateCommercialSeatQuantityAction = enhanceAction(
  async (data) => {
    const client = getSupabaseServerClient();
    const auth = await requireUser(client);

    if (auth.error || !auth.data) {
      throw new Error('Authentication required');
    }

    const userId = auth.data.id;
    const api = createTeamAccountsApi(client);
    const hasPermission = await api.hasPermission({
      userId,
      accountId: data.accountId,
      permission: 'billing.manage',
    });

    if (!hasPermission) {
      const [{ data: account }, { data: membership }] = await Promise.all([
        client
          .from('accounts')
          .select('primary_owner_user_id')
          .eq('id', data.accountId)
          .maybeSingle(),
        client
          .from('accounts_memberships')
          .select('account_role, company_role')
          .eq('account_id', data.accountId)
          .eq('user_id', userId)
          .maybeSingle(),
      ]);

      const isPrimaryOwner = account?.primary_owner_user_id === userId;
      const access = getTeamAccountAccess({
        role: membership?.account_role ?? null,
        company_role: membership?.company_role ?? null,
        permissions: [],
      });

      if (!isPrimaryOwner && !access.canManageBilling) {
        throw new Error('You do not have permission to manage billing');
      }
    }

    const breakdown = await getCommercialSeatBreakdown(client, data.accountId);

    if (data.quantity < breakdown.billableCount) {
      throw new Error(
        `Cannot schedule fewer than ${breakdown.billableCount} billable seats while that many members (and pending invites) are assigned. Remove or convert members first.`,
      );
    }

    const service = createAccountPerSeatBillingService(client);
    const result = await service.setBillableSeatQuantity(
      data.accountId,
      data.quantity,
    );

    if (
      result.timing === 'immediate' ||
      result.timing === 'cancelled_pending'
    ) {
      await client
        .from('account_plan_limits')
        .update({
          max_members: maxMembersForBillableSeats(result.quantity),
          pending_billable_seats: null,
          pending_seats_effective_at: null,
          updated_at: new Date().toISOString(),
        } as never)
        .eq('account_id', data.accountId);
    } else if (result.timing === 'period_end') {
      await client
        .from('account_plan_limits')
        .update({
          pending_billable_seats: result.pendingQuantity ?? data.quantity,
          pending_seats_effective_at: result.effectiveAt,
          updated_at: new Date().toISOString(),
        } as never)
        .eq('account_id', data.accountId);
    }

    revalidatePath(`/home/${data.accountSlug}/settings/billing`);
    revalidatePath(`/home/${data.accountSlug}/members`);

    return result;
  },
  {
    schema: UpdateCommercialSeatQuantitySchema,
  },
);
