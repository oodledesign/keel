import 'server-only';

/**
 * Dashboard shortcut catalog is derived from navigation config — not a duplicate list.
 *
 * - Personal: buildPersonalShortcutRoutes() (sidebar + supplements)
 * - Workspace: build*SpaceNavChildren() for each workspace the user can access
 * - Dynamic entities: dynamic-providers.ts (Rankly projects, etc.)
 *
 * When you add a sidebar nav item for a new feature, it appears in the shortcut
 * picker automatically. For sub-entities (e.g. per-project pages), add a provider.
 */

import type { SupabaseClient } from '@supabase/supabase-js';

import { buildCommunitySpaceNavChildren } from '~/config/community-account-navigation.config';
import { buildFamilySpaceNavChildren } from '~/config/family-account-navigation.config';
import pathsConfig from '~/config/paths.config';
import { buildPersonalShortcutRoutes } from '~/config/personal-account-navigation.config';
import { canUseEmailAssistant } from '~/lib/billing/entitlements';
import { buildPropertySpaceNavChildren } from '~/config/property-account-navigation.config';
import {
  buildWorkAppLinks,
  buildWorkSpaceNavChildren,
} from '~/config/work-account-navigation.config';
import { loadUserWorkspaceAccounts } from '~/home/_lib/server/workspace-scope';
import {
  getTeamAccountAccess,
  type TeamAccountAccess,
} from '~/home/[account]/_lib/role-access';
import { loadTeamWorkspace } from '~/home/[account]/_lib/server/team-account-workspace.loader';
import {
  spaceTypeFromProfile,
  type WorkspaceProfile,
} from '~/home/[account]/_lib/workspace-profile';

import { buildDynamicShortcutCatalog } from './dynamic-providers';
import { flattenNavItems, routeCatalogItem } from './resolve-href';
import type { ShortcutCatalogItem } from './types';

function personalCatalogItems(): ShortcutCatalogItem[] {
  return buildPersonalShortcutRoutes()
    .map((route) =>
      routeCatalogItem({
        label: route.label,
        href: route.path,
        category: 'Personal',
        description: route.description,
        keywords: route.keywords,
      }),
    )
    .filter((item): item is ShortcutCatalogItem => item !== null);
}

function navItemsForWorkspace(
  slug: string,
  profile: WorkspaceProfile,
  access: TeamAccountAccess,
  moduleSettings: Record<string, boolean> | undefined,
) {
  const spaceType = spaceTypeFromProfile(profile);
  if (spaceType === 'property') {
    return buildPropertySpaceNavChildren(slug, access, moduleSettings);
  }
  if (spaceType === 'family') {
    return buildFamilySpaceNavChildren(slug, access, moduleSettings);
  }
  if (spaceType === 'community') {
    return buildCommunitySpaceNavChildren(slug, access, moduleSettings);
  }
  const workItems = buildWorkSpaceNavChildren(slug, access, moduleSettings);
  const appLinks = buildWorkAppLinks(slug, moduleSettings);
  return [...workItems, ...appLinks];
}

function workspaceNavCatalogItems(
  slug: string,
  workspaceName: string,
  profile: WorkspaceProfile,
  access: TeamAccountAccess,
  moduleSettings: Record<string, boolean> | undefined,
): ShortcutCatalogItem[] {
  const nav = navItemsForWorkspace(slug, profile, access, moduleSettings);
  const flat = flattenNavItems(
    nav as Array<{
      label: string;
      path?: string;
      description?: string;
      children?: Array<{ label: string; path: string; description?: string }>;
    }>,
  );

  const items: ShortcutCatalogItem[] = [];
  const seenHrefs = new Set<string>();

  for (const entry of flat) {
    const item = routeCatalogItem({
      label: `${workspaceName} — ${entry.label}`,
      href: entry.path,
      category: workspaceName,
      description: entry.description,
      keywords: [entry.label, workspaceName, slug],
    });
    if (!item || seenHrefs.has(entry.path)) continue;
    seenHrefs.add(entry.path);
    items.push(item);
  }

  return items;
}

async function catalogForWorkspaceSlug(
  client: SupabaseClient,
  slug: string,
): Promise<ShortcutCatalogItem[]> {
  try {
    const workspace = await loadTeamWorkspace(slug);
    const account = workspace.account as {
      id: string;
      name?: string | null;
      permissions?: string[] | null;
      role?: string | null;
      company_role?: string | null;
    };
    const access = getTeamAccountAccess(account);
    const workspaceName = account.name?.trim() || slug;

    const navItems = workspaceNavCatalogItems(
      slug,
      workspaceName,
      workspace.workspaceProfile,
      access,
      workspace.moduleSettings,
    );

    const dynamicItems = await buildDynamicShortcutCatalog({
      client,
      accountId: account.id,
      accountSlug: slug,
      workspaceName,
      moduleSettings: workspace.moduleSettings,
    });

    return [...navItems, ...dynamicItems];
  } catch {
    return [];
  }
}

export async function buildPersonalShortcutCatalog(
  client: SupabaseClient,
  userId: string,
): Promise<ShortcutCatalogItem[]> {
  const emailAssistantAllowed = await canUseEmailAssistant(client, userId);
  const items: ShortcutCatalogItem[] = personalCatalogItems().filter((item) => {
    if (item.params.href === pathsConfig.app.personalEmailAssistant) {
      return emailAssistantAllowed;
    }

    return true;
  });
  const workspaces = await loadUserWorkspaceAccounts(client, userId);

  for (const ws of workspaces) {
    const slug = ws.slug?.trim();
    if (!slug) continue;
    const wsItems = await catalogForWorkspaceSlug(client, slug);
    items.push(...wsItems);
  }

  return items;
}

export async function buildWorkspaceShortcutCatalog(
  client: SupabaseClient,
  accountSlug: string,
): Promise<ShortcutCatalogItem[]> {
  return catalogForWorkspaceSlug(client, accountSlug);
}

export function filterCatalog(
  catalog: ShortcutCatalogItem[],
  query: string,
): ShortcutCatalogItem[] {
  const q = query.trim().toLowerCase();
  if (!q) return catalog;
  return catalog.filter((item) => {
    const haystack = [
      item.label,
      item.description ?? '',
      item.category,
      item.params.href ?? '',
      ...item.keywords,
    ]
      .join(' ')
      .toLowerCase();
    return haystack.includes(q);
  });
}
