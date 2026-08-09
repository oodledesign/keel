import 'server-only';

import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

import {
  loadClientPicturesByOrgIds,
  loadSupportBusinessBrand,
} from '~/lib/support/support-party-branding';

export type UserClientPortalMembership = {
  clientOrgId: string;
  slug: string;
  /** Client organisation name shown in the portal. */
  name: string;
  /** Hosting agency / workspace display name. */
  agencyName: string;
  agencyLogoUrl: string | null;
  clientLogoUrl: string | null;
};

/**
 * Client portals a user has contact access to, newest membership first.
 * Uses the admin client the same way listAcceptedGuestsForUser does —
 * this runs on the personal dashboard for any authenticated user, not
 * scoped to a single client_org's RLS context.
 */
export async function listUserClientPortalMemberships(
  userId: string,
): Promise<UserClientPortalMembership[]> {
  const admin = getSupabaseServerAdminClient();

  const { data: memberships, error } = await admin
    .from('client_members')
    .select('client_org_id, joined_at')
    .eq('user_id', userId)
    .order('joined_at', { ascending: false });

  if (error) {
    console.warn('[client-portal] list memberships for user:', error.message);
    return [];
  }

  const rows = (memberships ?? []) as Array<{
    client_org_id: string;
    joined_at: string | null;
  }>;

  if (rows.length === 0) return [];

  const orgIds = rows.map((row) => row.client_org_id);
  const [{ data: orgs }, clientPictures] = await Promise.all([
    admin
      .from('client_orgs')
      .select('id, slug, name, business_id')
      .in('id', orgIds),
    loadClientPicturesByOrgIds(admin, orgIds),
  ]);

  const orgRows = (orgs ?? []) as Array<{
    id: string;
    slug: string;
    name: string;
    business_id?: string | null;
  }>;
  const orgById = new Map(orgRows.map((org) => [org.id, org]));

  // Batch: business_id may be businesses.id or legacy accounts.id.
  const businessIds = [
    ...new Set(
      orgRows
        .map((org) => org.business_id?.trim())
        .filter((id): id is string => Boolean(id)),
    ),
  ];

  const accountIdByBusinessId = new Map<string, string>();
  if (businessIds.length > 0) {
    const [{ data: businesses }, { data: accounts }] = await Promise.all([
      admin.from('businesses').select('id, account_id').in('id', businessIds),
      admin.from('accounts').select('id').in('id', businessIds),
    ]);

    for (const row of (businesses ?? []) as Array<{
      id: string;
      account_id?: string | null;
    }>) {
      const accountId = row.account_id?.trim();
      if (accountId) accountIdByBusinessId.set(row.id, accountId);
    }
    for (const row of (accounts ?? []) as Array<{ id: string }>) {
      if (!accountIdByBusinessId.has(row.id)) {
        accountIdByBusinessId.set(row.id, row.id);
      }
    }
  }

  const accountIdByOrgId = new Map<string, string>();
  for (const org of orgRows) {
    const businessId = org.business_id?.trim();
    if (!businessId) continue;
    const accountId = accountIdByBusinessId.get(businessId);
    if (accountId) accountIdByOrgId.set(org.id, accountId);
  }

  const uniqueAccountIds = [...new Set(accountIdByOrgId.values())];
  const brandByAccountId = new Map<
    string,
    { name: string; logoUrl: string | null }
  >();
  await Promise.all(
    uniqueAccountIds.map(async (accountId) => {
      const brand = await loadSupportBusinessBrand(accountId);
      brandByAccountId.set(accountId, brand);
    }),
  );

  return rows
    .map((row) => {
      const org = orgById.get(row.client_org_id);
      if (!org?.slug) return null;

      const accountId = accountIdByOrgId.get(row.client_org_id);
      const agency = accountId ? brandByAccountId.get(accountId) : null;
      const clientName = org.name?.trim() || 'Client portal';

      return {
        clientOrgId: row.client_org_id,
        slug: org.slug,
        name: clientName,
        agencyName: agency?.name?.trim() || clientName,
        agencyLogoUrl: agency?.logoUrl ?? null,
        clientLogoUrl: clientPictures.get(row.client_org_id) ?? null,
      };
    })
    .filter((row): row is UserClientPortalMembership => row !== null);
}
