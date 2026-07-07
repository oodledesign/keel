import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import { loadUserTeamMemberships } from '~/home/_lib/server/user-team-memberships.loader';
import {
  resolveWorkspaceProfile,
  workspaceTypeLabel,
  type WorkspaceProfile,
} from '~/home/[account]/_lib/server/workspace-profile';
import { workspaceColorForSpaceType } from '~/home/(user)/_lib/workspace-accent';
import { spaceTypeFromProfile } from '~/home/[account]/_lib/server/workspace-profile';
import { toSupabasePublicStorageUrl } from '~/lib/storage/public-url';

export type WorkspaceSwitcherAccount = {
  id: string;
  label: string;
  slug: string;
  value: string;
  image: string | null;
  profile: WorkspaceProfile;
  typeLabel: string;
  accentColor: string;
  createdAt: string;
};

export async function loadWorkspaceSwitcherAccounts(
  client: SupabaseClient,
  userId: string,
): Promise<WorkspaceSwitcherAccount[]> {
  const teamAccounts = (await loadUserTeamMemberships(userId, client)).filter(
    (acc) => acc.slug,
  );

  const accountIds = teamAccounts.map((a) => a.id);
  const businessTypeByAccount = new Map<string, string>();
  const brandLogoByAccount = new Map<string, string>();

  if (accountIds.length > 0) {
    const { data: bizRows } = await client
      .from('businesses')
      .select('account_id, type')
      .in('account_id', accountIds);

    for (const row of bizRows ?? []) {
      const aid = (row as { account_id?: string }).account_id;
      const typ = (row as { type?: string }).type;
      if (aid && typ && !businessTypeByAccount.has(aid)) {
        businessTypeByAccount.set(aid, typ);
      }
    }

    const missingPictureIds = teamAccounts
      .filter((acc) => !acc.picture_url)
      .map((acc) => acc.id);

    if (missingPictureIds.length > 0) {
      const { data: brandRows } = await client
        .from('account_brand_settings')
        .select('account_id, logo_url')
        .in('account_id', missingPictureIds);

      for (const row of brandRows ?? []) {
        const aid = (row as { account_id?: string }).account_id;
        const logo = (row as { logo_url?: string | null }).logo_url;
        if (aid && logo) {
          brandLogoByAccount.set(aid, logo);
        }
      }
    }
  }

  return teamAccounts.map((acc) => {
    const profile = resolveWorkspaceProfile({
      space_type: acc.space_type,
      business_type: businessTypeByAccount.get(acc.id) ?? null,
    });
    const label = acc.name?.trim() || acc.slug!;
    return {
      id: acc.id,
      label,
      slug: acc.slug!,
      value: acc.slug!,
      image:
        toSupabasePublicStorageUrl(acc.picture_url) ??
        toSupabasePublicStorageUrl(brandLogoByAccount.get(acc.id)) ??
        null,
      profile,
      typeLabel: workspaceTypeLabel(profile),
      accentColor: workspaceColorForSpaceType(spaceTypeFromProfile(profile)),
      createdAt: acc.created_at ?? '',
    };
  });
}
