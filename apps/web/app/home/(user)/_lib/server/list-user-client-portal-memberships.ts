import 'server-only';

import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

export type UserClientPortalMembership = {
  clientOrgId: string;
  slug: string;
  name: string;
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
  const { data: orgs } = await admin
    .from('client_orgs')
    .select('id, slug, name')
    .in('id', orgIds);

  const orgById = new Map(
    ((orgs ?? []) as Array<{ id: string; slug: string; name: string }>).map(
      (org) => [org.id, org],
    ),
  );

  return rows
    .map((row) => {
      const org = orgById.get(row.client_org_id);
      if (!org?.slug) return null;
      return {
        clientOrgId: row.client_org_id,
        slug: org.slug,
        name: org.name?.trim() || 'Client portal',
      };
    })
    .filter((row): row is UserClientPortalMembership => row !== null);
}
