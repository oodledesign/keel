import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import pathsConfig from '~/config/paths.config';
import { loadUserWorkspaceAccounts } from '~/home/_lib/server/workspace-scope';

import { buildPersonalShortcutCatalog, buildWorkspaceShortcutCatalog } from './build-catalog';
import { resolveStoredShortcuts } from './resolve-shortcuts';
import type {
  DefaultLandingPreference,
  ResolvedShortcut,
  StoredShortcut,
} from './types';
import { parseStoredShortcuts } from './types';

export async function loadPersonalMobileNavShortcuts(
  client: SupabaseClient,
  userId: string,
): Promise<ResolvedShortcut[]> {
  const { data } = await client
    .from('user_settings')
    .select('personal_mobile_nav_shortcuts')
    .eq('user_id', userId)
    .maybeSingle();

  const stored = parseStoredShortcuts(
    (data as { personal_mobile_nav_shortcuts?: unknown } | null)
      ?.personal_mobile_nav_shortcuts,
  );

  if (stored.length === 0) return [];

  const catalog = await buildPersonalShortcutCatalog(client, userId);
  return resolveStoredShortcuts(stored, catalog);
}

export async function loadWorkspaceMobileNavShortcuts(
  client: SupabaseClient,
  userId: string,
  accountId: string,
  accountSlug: string,
): Promise<ResolvedShortcut[]> {
  const { data } = await client
    .from('workspace_dashboard_shortcuts')
    .select('mobile_nav_shortcuts')
    .eq('user_id', userId)
    .eq('account_id', accountId)
    .maybeSingle();

  const stored = parseStoredShortcuts(
    (data as { mobile_nav_shortcuts?: unknown } | null)?.mobile_nav_shortcuts,
  );

  if (stored.length === 0) return [];

  const catalog = await buildWorkspaceShortcutCatalog(client, accountSlug);
  return resolveStoredShortcuts(stored, catalog);
}

export async function loadPersonalDashboardShortcuts(
  client: SupabaseClient,
  userId: string,
): Promise<ResolvedShortcut[]> {
  const { data } = await client
    .from('user_settings')
    .select('personal_dashboard_shortcuts')
    .eq('user_id', userId)
    .maybeSingle();

  const stored = parseStoredShortcuts(
    (data as { personal_dashboard_shortcuts?: unknown } | null)
      ?.personal_dashboard_shortcuts,
  );

  if (stored.length === 0) return [];

  const catalog = await buildPersonalShortcutCatalog(client, userId);
  return resolveStoredShortcuts(stored, catalog);
}

export async function loadWorkspaceDashboardShortcuts(
  client: SupabaseClient,
  userId: string,
  accountId: string,
  accountSlug: string,
): Promise<ResolvedShortcut[]> {
  const { data } = await client
    .from('workspace_dashboard_shortcuts')
    .select('shortcuts')
    .eq('user_id', userId)
    .eq('account_id', accountId)
    .maybeSingle();

  const stored = parseStoredShortcuts(
    (data as { shortcuts?: unknown } | null)?.shortcuts,
  );

  if (stored.length === 0) return [];

  const catalog = await buildWorkspaceShortcutCatalog(client, accountSlug);
  return resolveStoredShortcuts(stored, catalog);
}

export async function loadDefaultLandingPreference(
  client: SupabaseClient,
  userId: string,
): Promise<DefaultLandingPreference> {
  const { data } = await client
    .from('user_settings')
    .select('default_landing_type, default_workspace_slug')
    .eq('user_id', userId)
    .maybeSingle();

  const row = data as {
    default_landing_type?: string | null;
    default_workspace_slug?: string | null;
  } | null;

  const type =
    row?.default_landing_type === 'workspace' ? 'workspace' : 'personal';

  return {
    type,
    workspaceSlug: row?.default_workspace_slug?.trim() || null,
  };
}

export async function getUserDefaultLandingPath(
  client: SupabaseClient,
  userId: string,
): Promise<string> {
  const pref = await loadDefaultLandingPreference(client, userId);

  if (pref.type !== 'workspace' || !pref.workspaceSlug) {
    return pathsConfig.app.home;
  }

  const workspaces = await loadUserWorkspaceAccounts(client, userId);
  const allowed = workspaces.some((w) => w.slug === pref.workspaceSlug);

  if (!allowed) {
    return pathsConfig.app.home;
  }

  return pathsConfig.app.accountHome.replace('[account]', pref.workspaceSlug);
}

export async function loadPersonalShortcutsSettings(
  client: SupabaseClient,
  userId: string,
): Promise<{
  shortcuts: StoredShortcut[];
  mobileNavShortcuts: StoredShortcut[];
  defaultLanding: DefaultLandingPreference;
  workspaceOptions: Array<{ slug: string; name: string }>;
}> {
  const [settingsRes, workspaces] = await Promise.all([
    client
      .from('user_settings')
      .select(
        'personal_dashboard_shortcuts, personal_mobile_nav_shortcuts, default_landing_type, default_workspace_slug',
      )
      .eq('user_id', userId)
      .maybeSingle(),
    loadUserWorkspaceAccounts(client, userId),
  ]);

  const row = settingsRes.data as {
    personal_dashboard_shortcuts?: unknown;
    personal_mobile_nav_shortcuts?: unknown;
    default_landing_type?: string | null;
    default_workspace_slug?: string | null;
  } | null;

  return {
    shortcuts: parseStoredShortcuts(row?.personal_dashboard_shortcuts),
    mobileNavShortcuts: parseStoredShortcuts(row?.personal_mobile_nav_shortcuts),
    defaultLanding: {
      type:
        row?.default_landing_type === 'workspace' ? 'workspace' : 'personal',
      workspaceSlug: row?.default_workspace_slug?.trim() || null,
    },
    workspaceOptions: workspaces
      .filter((w) => w.slug)
      .map((w) => ({
        slug: w.slug!,
        name: w.name?.trim() || w.slug!,
      })),
  };
}

export async function loadWorkspaceShortcutsSettings(
  client: SupabaseClient,
  userId: string,
  accountId: string,
): Promise<{ shortcuts: StoredShortcut[]; mobileNavShortcuts: StoredShortcut[] }> {
  const { data } = await client
    .from('workspace_dashboard_shortcuts')
    .select('shortcuts, mobile_nav_shortcuts')
    .eq('user_id', userId)
    .eq('account_id', accountId)
    .maybeSingle();

  return {
    shortcuts: parseStoredShortcuts(
      (data as { shortcuts?: unknown } | null)?.shortcuts,
    ),
    mobileNavShortcuts: parseStoredShortcuts(
      (data as { mobile_nav_shortcuts?: unknown } | null)?.mobile_nav_shortcuts,
    ),
  };
}
