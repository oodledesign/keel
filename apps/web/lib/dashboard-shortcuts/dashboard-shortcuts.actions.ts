'use server';

import { revalidatePath } from 'next/cache';

import { getSupabaseServerClient } from '@kit/supabase/server-client';

import pathsConfig from '~/config/paths.config';
import { loadUserWorkspaceAccounts } from '~/home/_lib/server/workspace-scope';
import { requireUserInServerComponent } from '~/lib/server/require-user-in-server-component';

import {
  MobileNavShortcutsArraySchema,
  StoredShortcutsArraySchema,
  type DefaultLandingType,
  type StoredShortcut,
} from './types';

function revalidatePersonalDashboard() {
  revalidatePath('/home', 'layout');
  revalidatePath('/app', 'layout');
  revalidatePath(pathsConfig.app.personalAccountSettings);
}

function revalidateWorkspaceDashboard(slug: string) {
  const publicHome = pathsConfig.app.accountHome.replace('[account]', slug);

  revalidatePath(`/home/${slug}`, 'layout');
  revalidatePath(`/app/${slug}`, 'layout');
  revalidatePath(publicHome, 'layout');
  revalidatePath(publicHome);
  revalidatePath(
    pathsConfig.app.accountSettings.replace('[account]', slug),
  );
}

export async function savePersonalDashboardShortcutsAction(
  shortcuts: StoredShortcut[],
  mobileNavShortcuts?: StoredShortcut[],
  includeWorkspaceTasks?: boolean,
) {
  try {
    const parsed = StoredShortcutsArraySchema.parse(shortcuts);
    const parsedMobile = mobileNavShortcuts
      ? MobileNavShortcutsArraySchema.parse(mobileNavShortcuts)
      : undefined;
    const client = getSupabaseServerClient();
    const user = await requireUserInServerComponent();

    const { error } = await client.from('user_settings').upsert(
      {
        user_id: user.id,
        personal_dashboard_shortcuts: parsed,
        ...(parsedMobile !== undefined
          ? { personal_mobile_nav_shortcuts: parsedMobile }
          : {}),
        ...(includeWorkspaceTasks !== undefined
          ? { personal_include_workspace_tasks: includeWorkspaceTasks }
          : {}),
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' },
    );

    if (error) return { success: false as const, error: error.message };

    revalidatePersonalDashboard();
    revalidatePath(`${pathsConfig.app.home}/tasks`);
    return { success: true as const, error: null };
  } catch (err) {
    return {
      success: false as const,
      error: err instanceof Error ? err.message : 'Could not save shortcuts',
    };
  }
}

export async function savePersonalIncludeWorkspaceTasksAction(
  includeWorkspaceTasks: boolean,
) {
  try {
    const client = getSupabaseServerClient();
    const user = await requireUserInServerComponent();

    const { error } = await client.from('user_settings').upsert(
      {
        user_id: user.id,
        personal_include_workspace_tasks: includeWorkspaceTasks,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' },
    );

    if (error) return { success: false as const, error: error.message };

    revalidatePersonalDashboard();
    revalidatePath(`${pathsConfig.app.home}/tasks`);
    revalidatePath(pathsConfig.app.personalAccountSettings);
    return { success: true as const, error: null };
  } catch (err) {
    return {
      success: false as const,
      error: err instanceof Error ? err.message : 'Could not save preference',
    };
  }
}

export async function saveDefaultLandingAction(input: {
  type: DefaultLandingType;
  workspaceSlug?: string | null;
}) {
  try {
    const client = getSupabaseServerClient();
    const user = await requireUserInServerComponent();

    let workspaceSlug: string | null = null;
    if (input.type === 'workspace') {
      const slug = input.workspaceSlug?.trim();
      if (!slug) {
        return {
          success: false as const,
          error: 'Choose a workspace for your default landing page.',
        };
      }
      const workspaces = await loadUserWorkspaceAccounts(client, user.id);
      if (!workspaces.some((w) => w.slug === slug)) {
        return {
          success: false as const,
          error: 'You do not have access to that workspace.',
        };
      }
      workspaceSlug = slug;
    }

    const { error } = await client.from('user_settings').upsert(
      {
        user_id: user.id,
        default_landing_type: input.type,
        default_workspace_slug: workspaceSlug,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' },
    );

    if (error) return { success: false as const, error: error.message };

    revalidatePersonalDashboard();
    revalidatePath(pathsConfig.app.personalAccountSettings);
    return { success: true as const, error: null };
  } catch (err) {
    return {
      success: false as const,
      error: err instanceof Error ? err.message : 'Could not save preference',
    };
  }
}

export async function saveWorkspaceDashboardShortcutsAction(input: {
  accountId: string;
  accountSlug: string;
  shortcuts: StoredShortcut[];
  mobileNavShortcuts?: StoredShortcut[];
}) {
  try {
    const parsed = StoredShortcutsArraySchema.parse(input.shortcuts);
    const parsedMobile = input.mobileNavShortcuts
      ? MobileNavShortcutsArraySchema.parse(input.mobileNavShortcuts)
      : undefined;
    const client = getSupabaseServerClient();
    const user = await requireUserInServerComponent();

    const { error } = await client.from('workspace_dashboard_shortcuts').upsert(
      {
        user_id: user.id,
        account_id: input.accountId,
        shortcuts: parsed,
        ...(parsedMobile !== undefined
          ? { mobile_nav_shortcuts: parsedMobile }
          : {}),
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,account_id' },
    );

    if (error) return { success: false as const, error: error.message };

    revalidateWorkspaceDashboard(input.accountSlug);
    revalidatePath(
      pathsConfig.app.accountSettings.replace('[account]', input.accountSlug),
    );
    return { success: true as const, error: null };
  } catch (err) {
    return {
      success: false as const,
      error: err instanceof Error ? err.message : 'Could not save shortcuts',
    };
  }
}

export async function searchShortcutCatalogAction(input: {
  scope: 'personal' | 'workspace';
  accountSlug?: string;
  query: string;
}) {
  try {
    const client = getSupabaseServerClient();
    const user = await requireUserInServerComponent();

    const { buildPersonalShortcutCatalog, buildWorkspaceShortcutCatalog, filterCatalog } =
      await import('./build-catalog');

    const catalog =
      input.scope === 'workspace' && input.accountSlug
        ? await buildWorkspaceShortcutCatalog(client, input.accountSlug)
        : await buildPersonalShortcutCatalog(client, user.id);

    return {
      success: true as const,
      items: filterCatalog(catalog, input.query),
      error: null,
    };
  } catch (err) {
    return {
      success: false as const,
      items: [],
      error: err instanceof Error ? err.message : 'Search failed',
    };
  }
}
