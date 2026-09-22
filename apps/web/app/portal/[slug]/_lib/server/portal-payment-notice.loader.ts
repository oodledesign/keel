import 'server-only';

import { cache } from 'react';

import { getSupabaseServerClient } from '@kit/supabase/server-client';

import {
  type PortalPaymentNotice,
  selectPortalPaymentNotice,
} from '~/lib/billing/portal-payment-notice';

export const loadPortalPaymentNotice = cache(
  async (clientOrgId: string): Promise<PortalPaymentNotice | null> => {
    const client = getSupabaseServerClient();
    // billing_collection is newer than generated Database types.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- pending typegen
    const subscriptions = client as any;
    const { data, error } = await subscriptions
      .from('client_subscriptions')
      .select('id, plan_name, status, billing_collection')
      .eq('client_org_id', clientOrgId)
      .in('status', [
        'pending',
        'incomplete',
        'overdue',
        'past_due',
        'unpaid',
        'failed',
      ])
      .order('created_at', { ascending: false })
      .limit(20);

    if (error) {
      console.error('[portal] loadPortalPaymentNotice:', error.message);
      return null;
    }

    return selectPortalPaymentNotice(
      ((data ?? []) as Array<Record<string, unknown>>).map((row) => ({
        id: String(row.id),
        planName: String(row.plan_name ?? 'Subscription'),
        status: row.status ? String(row.status) : null,
        billingCollection: row.billing_collection
          ? String(row.billing_collection)
          : null,
      })),
    );
  },
);
