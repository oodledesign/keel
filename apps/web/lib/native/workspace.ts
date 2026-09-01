import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import { loadWorkspaceSwitcherAccounts } from '~/home/_lib/server/workspace-switcher.loader';
import { toSupabasePublicStorageUrl } from '~/lib/storage/public-url';

import { NativeHttpError } from './http';
import {
  type NativeWorkspace,
  findNativeWorkspace,
  publicHttpsImageUrl,
  toNativeWorkspaceProfile,
} from './workspace-shared';

export type {
  NativeWorkspace,
  NativeWorkspaceProfile,
} from './workspace-shared';
export {
  findNativeWorkspace,
  NATIVE_WORKSPACE_PROFILES,
  publicNativeWorkspace,
  toNativeWorkspaceProfile,
} from './workspace-shared';

export async function loadPersonalNativeWorkspace(
  client: SupabaseClient,
  userId: string,
): Promise<NativeWorkspace | null> {
  const { data, error } = await client
    .from('accounts')
    .select('id, name, slug, picture_url')
    .eq('primary_owner_user_id', userId)
    .eq('is_personal_account', true)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  const slug = data?.slug?.trim();
  if (!data?.id || !slug) {
    return null;
  }

  return {
    id: data.id,
    slug,
    name: data.name?.trim() || slug,
    profile: 'personal',
    isPersonal: true,
    image: await resolvePersonalWorkspaceImage(
      client,
      data.id,
      data.picture_url,
    ),
  };
}

export async function loadNativeWorkspaces(
  client: SupabaseClient,
  userId: string,
): Promise<NativeWorkspace[]> {
  const [personal, teams] = await Promise.all([
    loadPersonalNativeWorkspace(client, userId),
    loadWorkspaceSwitcherAccounts(client, userId),
  ]);

  const workspaces: NativeWorkspace[] = [];

  if (personal) {
    workspaces.push(personal);
  }

  for (const team of teams) {
    workspaces.push({
      id: team.id,
      slug: team.slug,
      name: team.label,
      profile: toNativeWorkspaceProfile(team.profile),
      isPersonal: false,
      image: publicHttpsImageUrl(team.image),
    });
  }

  return workspaces;
}

export async function requireNativeWorkspace(
  client: SupabaseClient,
  userId: string,
  workspaceRef: string | null | undefined,
): Promise<NativeWorkspace> {
  const ref = workspaceRef?.trim() ?? '';
  if (!ref) {
    throw new NativeHttpError(400, 'workspace is required');
  }

  const workspaces = await loadNativeWorkspaces(client, userId);
  const workspace = findNativeWorkspace(workspaces, ref);

  if (!workspace) {
    throw new NativeHttpError(403, 'You are not a member of this workspace');
  }

  return workspace;
}

async function resolvePersonalWorkspaceImage(
  client: SupabaseClient,
  accountId: string,
  pictureUrl: string | null | undefined,
): Promise<string | null> {
  const fromPicture = publicHttpsImageUrl(
    toSupabasePublicStorageUrl(pictureUrl),
  );
  if (fromPicture) {
    return fromPicture;
  }

  const { data: brand } = await client
    .from('account_brand_settings')
    .select('logo_url')
    .eq('account_id', accountId)
    .maybeSingle();

  return publicHttpsImageUrl(
    toSupabasePublicStorageUrl(
      (brand as { logo_url?: string | null } | null)?.logo_url,
    ),
  );
}
