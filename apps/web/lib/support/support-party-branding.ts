import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import { loadAccountBrandResolved } from '~/lib/brand/account-brand';
import { toSupabasePublicStorageUrl } from '~/lib/storage/public-url';

export type SupportPartyBrand = {
  name: string;
  logoUrl: string | null;
};

/**
 * Best client logo per client org (CRM `clients.picture_url` via `client_org_id`).
 */
export async function loadClientPicturesByOrgIds(
  client: SupabaseClient,
  orgIds: string[],
): Promise<Map<string, string>> {
  const unique = [...new Set(orgIds.filter(Boolean))];
  const map = new Map<string, string>();
  if (unique.length === 0) return map;

  const { data } = await client
    .from('clients')
    .select('client_org_id, picture_url')
    .in('client_org_id', unique)
    .not('picture_url', 'is', null);

  for (const row of data ?? []) {
    const orgId = (row as { client_org_id?: string | null }).client_org_id;
    const picture = toSupabasePublicStorageUrl(
      (row as { picture_url?: string | null }).picture_url?.trim(),
    );
    if (!orgId || !picture || map.has(orgId)) continue;
    map.set(orgId, picture);
  }

  return map;
}

export async function loadSupportBusinessBrand(
  accountId: string,
): Promise<SupportPartyBrand> {
  try {
    const [brand, account] = await Promise.all([
      loadAccountBrandResolved(accountId),
      (async () => {
        const { getSupabaseServerAdminClient } =
          await import('@kit/supabase/server-admin-client');
        const admin = getSupabaseServerAdminClient();
        const { data } = await admin
          .from('accounts')
          .select('name, slug, picture_url')
          .eq('id', accountId)
          .maybeSingle();
        return data as {
          name?: string | null;
          slug?: string | null;
          picture_url?: string | null;
        } | null;
      })(),
    ]);

    const logoUrl =
      brand.logo_url ||
      toSupabasePublicStorageUrl(account?.picture_url?.trim()) ||
      null;

    return {
      name: account?.name?.trim() || account?.slug?.trim() || 'Business',
      logoUrl,
    };
  } catch (error) {
    console.warn('[support] loadSupportBusinessBrand failed:', error);
    return { name: 'Business', logoUrl: null };
  }
}

export async function loadSupportClientBrand(
  client: SupabaseClient,
  clientOrgId: string | null | undefined,
  fallbackName?: string | null,
): Promise<SupportPartyBrand | null> {
  if (!clientOrgId) return null;

  const { data: org } = await client
    .from('client_orgs')
    .select('id, name, slug')
    .eq('id', clientOrgId)
    .maybeSingle();

  const pictures = await loadClientPicturesByOrgIds(client, [clientOrgId]);
  const name =
    fallbackName?.trim() ||
    (org as { name?: string | null } | null)?.name?.trim() ||
    (org as { slug?: string | null } | null)?.slug?.trim() ||
    'Client';

  return {
    name,
    logoUrl: pictures.get(clientOrgId) ?? null,
  };
}
