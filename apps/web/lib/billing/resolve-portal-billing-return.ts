import 'server-only';

import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

import { portalBillingReturnPath } from './client-subscription-lifecycle';
import { getSiteOrigin } from './stripe-connect';

type QueryBuilder<T> = PromiseLike<{
  data: T | null;
  error: { message: string } | null;
}> & {
  select: (columns: string) => QueryBuilder<T>;
  eq: (column: string, value: string) => QueryBuilder<T>;
  maybeSingle: () => Promise<{
    data: T | null;
    error: { message: string } | null;
  }>;
};

type DynamicAdmin = {
  from: (table: string) => {
    select: <T>(columns: string) => QueryBuilder<T>;
  };
};

export async function resolvePortalBillingReturnUrl(
  subscriptionId: string,
  outcome: 'paid' | 'cancelled',
): Promise<string | null> {
  const admin = getSupabaseServerAdminClient() as unknown as DynamicAdmin;

  const { data: sub } = await admin
    .from('client_subscriptions')
    .select<{
      client_org_id: string | null;
      client_id: string | null;
    }>('client_org_id, client_id')
    .eq('id', subscriptionId)
    .maybeSingle();

  let orgId = sub?.client_org_id ?? null;
  if (!orgId && sub?.client_id) {
    const { data: client } = await admin
      .from('clients')
      .select<{ client_org_id: string | null }>('client_org_id')
      .eq('id', sub.client_id)
      .maybeSingle();
    orgId = client?.client_org_id ?? null;
  }

  if (!orgId) return null;

  const { data: org } = await admin
    .from('client_orgs')
    .select<{ slug: string | null }>('slug')
    .eq('id', orgId)
    .maybeSingle();

  const slug = org?.slug?.trim();
  if (!slug) return null;

  return `${getSiteOrigin()}${portalBillingReturnPath(slug, outcome)}`;
}
