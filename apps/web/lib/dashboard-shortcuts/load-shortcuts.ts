import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import pathsConfig from '~/config/paths.config';
import { loadUserTeamMemberships } from '~/home/_lib/server/user-team-memberships.loader';
import { loadUserWorkspaceAccounts } from '~/home/_lib/server/workspace-scope';

import {
  buildPersonalShortcutCatalog,
  buildWorkspaceLandingCatalog,
  buildWorkspaceShortcutCatalog,
} from './build-catalog';
import { enrichPersonalShortcutsWithWorkspaceAvatars } from './enrich-workspace-shortcut-avatars';
import { resolveDefaultLandingHref } from './resolve-default-landing';
import type { WorkspaceLandingPageOption } from './resolve-default-landing';
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
    .select('personal_dashboard_shortcuts, personal_mobile_nav_shortcuts')
    .eq('user_id', userId)
    .maybeSingle();

  const row = data as {
    personal_dashboard_shortcuts?: unknown;
    personal_mobile_nav_shortcuts?: unknown;
  } | null;

  let stored = parseStoredShortcuts(row?.personal_mobile_nav_shortcuts);

  if (stored.length === 0) {
    stored = parseStoredShortcuts(row?.personal_dashboard_shortcuts).slice(
      0,
      3,
    );
  }

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
    .select('shortcuts, mobile_nav_shortcuts')
    .eq('user_id', userId)
    .eq('account_id', accountId)
    .maybeSingle();

  const row = data as {
    shortcuts?: unknown;
    mobile_nav_shortcuts?: unknown;
  } | null;

  let stored = parseStoredShortcuts(row?.mobile_nav_shortcuts);

  if (stored.length === 0) {
    stored = parseStoredShortcuts(row?.shortcuts).slice(0, 3);
  }

  if (stored.length === 0) return [];

  const catalog = await buildWorkspaceShortcutCatalog(client, accountSlug);
  return resolveStoredShortcuts(stored, catalog, {
    workspaceSlug: accountSlug,
  });
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

  const [catalog, workspaces] = await Promise.all([
    buildPersonalShortcutCatalog(client, userId),
    loadUserWorkspaceAccounts(client, userId),
  ]);
  const resolved = resolveStoredShortcuts(stored, catalog);

  return enrichPersonalShortcutsWithWorkspaceAvatars(resolved, workspaces);
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
  return resolveStoredShortcuts(stored, catalog, {
    workspaceSlug: accountSlug,
  });
}

export async function loadDefaultLandingPreference(
  client: SupabaseClient,
  userId: string,
): Promise<DefaultLandingPreference> {
  const { data } = await client
    .from('user_settings')
    .select(
      'default_landing_type, default_workspace_slug, default_landing_catalog_id, default_landing_params',
    )
    .eq('user_id', userId)
    .maybeSingle();

  const row = data as {
    default_landing_type?: string | null;
    default_workspace_slug?: string | null;
    default_landing_catalog_id?: string | null;
    default_landing_params?: unknown;
  } | null;

  return parseDefaultLandingPreference(row);
}

export async function getUserDefaultLandingPath(
  client: SupabaseClient,
  userId: string,
): Promise<string> {
  const teamMemberships = await loadUserTeamMemberships(userId, client);

  if (teamMemberships.length === 0) {
    // Explicit "continue with personal" from /setup — respect it and don't
    // bounce them straight back to their portal.
    const { data: settings } = await client
      .from('user_settings')
      .select('workspace_setup_skipped_at')
      .eq('user_id', userId)
      .maybeSingle();

    const skippedSetup = Boolean(
      (settings as { workspace_setup_skipped_at?: string | null } | null)
        ?.workspace_setup_skipped_at,
    );

    if (skippedSetup) {
      return pathsConfig.app.home;
    }

    const { data: portalMemberships } = await client
      .from('client_members')
      .select('client_org_id, joined_at')
      .eq('user_id', userId)
      .order('joined_at', { ascending: false });

    const rows = (portalMemberships ?? []) as Array<{
      client_org_id: string;
      joined_at: string | null;
    }>;

    if (rows.length === 1) {
      const { data: org } = await client
        .from('client_orgs')
        .select('slug')
        .eq('id', rows[0]!.client_org_id)
        .maybeSingle();

      const slug = (org as { slug?: string | null } | null)?.slug;
      if (slug) {
        return pathsConfig.app.clientPortalHome.replace('[clientSlug]', slug);
      }
    }

    // Zero or multiple portal memberships — fall through to the personal
    // home page, which renders a "Client portals" picker for this case.
    if (rows.length > 1) {
      return pathsConfig.app.home;
    }
  }

  const pref = await loadDefaultLandingPreference(client, userId);

  if (pref.type !== 'workspace' || !pref.workspaceSlug) {
    return pathsConfig.app.home;
  }

  const workspaces = await loadUserWorkspaceAccounts(client, userId);
  const allowed = workspaces.some((w) => w.slug === pref.workspaceSlug);

  if (!allowed) {
    return pathsConfig.app.home;
  }

  return (
    resolveDefaultLandingHref(pref) ??
    pathsConfig.app.accountHome.replace('[account]', pref.workspaceSlug)
  );
}

export async function loadPersonalShortcutsSettings(
  client: SupabaseClient,
  userId: string,
): Promise<{
  shortcuts: StoredShortcut[];
  mobileNavShortcuts: StoredShortcut[];
  defaultLanding: DefaultLandingPreference;
  includeWorkspaceTasks: boolean;
  workspaceOptions: Array<{ slug: string; name: string }>;
  workspaceLandingPages: Record<string, WorkspaceLandingPageOption[]>;
}> {
  const [settingsRes, workspaces] = await Promise.all([
    client
      .from('user_settings')
      .select(
        'personal_dashboard_shortcuts, personal_mobile_nav_shortcuts, default_landing_type, default_workspace_slug, default_landing_catalog_id, default_landing_params, personal_include_workspace_tasks',
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
    default_landing_catalog_id?: string | null;
    default_landing_params?: unknown;
    personal_include_workspace_tasks?: boolean | null;
  } | null;

  const workspaceOptions = workspaces
    .filter((w) => w.slug)
    .map((w) => ({
      slug: w.slug!,
      name: w.name?.trim() || w.slug!,
    }));

  const workspaceLandingPages: Record<string, WorkspaceLandingPageOption[]> =
    {};
  await Promise.all(
    workspaceOptions.map(async (workspace) => {
      workspaceLandingPages[workspace.slug] =
        await buildWorkspaceLandingCatalog(client, workspace.slug);
    }),
  );

  return {
    shortcuts: parseStoredShortcuts(row?.personal_dashboard_shortcuts),
    mobileNavShortcuts: parseStoredShortcuts(
      row?.personal_mobile_nav_shortcuts,
    ),
    defaultLanding: parseDefaultLandingPreference(row),
    includeWorkspaceTasks: row?.personal_include_workspace_tasks !== false,
    workspaceOptions,
    workspaceLandingPages,
  };
}

function parseDefaultLandingPreference(
  row: {
    default_landing_type?: string | null;
    default_workspace_slug?: string | null;
    default_landing_catalog_id?: string | null;
    default_landing_params?: unknown;
  } | null,
): DefaultLandingPreference {
  const params =
    row?.default_landing_params &&
    typeof row.default_landing_params === 'object' &&
    !Array.isArray(row.default_landing_params)
      ? Object.fromEntries(
          Object.entries(
            row.default_landing_params as Record<string, unknown>,
          ).filter(
            (entry): entry is [string, string] => typeof entry[1] === 'string',
          ),
        )
      : {};

  return {
    type: row?.default_landing_type === 'workspace' ? 'workspace' : 'personal',
    workspaceSlug: row?.default_workspace_slug?.trim() || null,
    catalogId: row?.default_landing_catalog_id?.trim() || null,
    params,
  };
}

export async function loadWorkspaceShortcutsSettings(
  client: SupabaseClient,
  userId: string,
  accountId: string,
): Promise<{
  shortcuts: StoredShortcut[];
  mobileNavShortcuts: StoredShortcut[];
}> {
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
