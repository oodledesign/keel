import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import {
  loadPersonalMobileNavShortcuts,
  loadPersonalShortcutsSettings,
  loadWorkspaceMobileNavShortcuts,
  loadWorkspaceShortcutsSettings,
} from '~/lib/dashboard-shortcuts/load-shortcuts';
import {
  MobileNavShortcutsArraySchema,
  type ResolvedShortcut,
  type StoredShortcut,
} from '~/lib/dashboard-shortcuts/types';

import { NativeHttpError } from './http';
import type { NativeWorkspace } from './workspace';

export type NativePin = {
  id: string;
  catalog_id: string;
  label: string;
  href: string;
  icon_key?: string;
  params: Record<string, string>;
};

function toNativePins(
  stored: StoredShortcut[],
  resolved: ResolvedShortcut[],
): NativePin[] {
  const resolvedById = new Map(resolved.map((item) => [item.id, item]));

  return stored.slice(0, 3).map((item) => {
    const match = resolvedById.get(item.id);
    return {
      id: item.id,
      catalog_id: item.catalogId,
      label: match?.label || item.label || 'Shortcut',
      href: match?.href ?? '',
      icon_key: match?.iconKey ?? item.iconKey,
      params: item.params,
    };
  });
}

export async function loadNativePins(
  client: SupabaseClient,
  userId: string,
  workspace: NativeWorkspace,
) {
  if (workspace.isPersonal) {
    const [settings, resolved] = await Promise.all([
      loadPersonalShortcutsSettings(client, userId),
      loadPersonalMobileNavShortcuts(client, userId),
    ]);

    return {
      workspace: workspace.slug,
      pins: toNativePins(settings.mobileNavShortcuts, resolved),
    };
  }

  const [settings, resolved] = await Promise.all([
    loadWorkspaceShortcutsSettings(client, userId, workspace.id),
    loadWorkspaceMobileNavShortcuts(
      client,
      userId,
      workspace.id,
      workspace.slug,
    ),
  ]);

  return {
    workspace: workspace.slug,
    pins: toNativePins(settings.mobileNavShortcuts, resolved),
  };
}

export async function saveNativePins(input: {
  client: SupabaseClient;
  userId: string;
  workspace: NativeWorkspace;
  pins: unknown;
}) {
  const parsed = MobileNavShortcutsArraySchema.safeParse(input.pins);
  if (!parsed.success) {
    throw new NativeHttpError(
      400,
      'pins must be an array of at most 3 shortcuts',
    );
  }

  if (input.workspace.isPersonal) {
    const { error } = await input.client.from('user_settings').upsert(
      {
        user_id: input.userId,
        personal_mobile_nav_shortcuts: parsed.data,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' },
    );

    if (error) {
      throw new Error(error.message);
    }
  } else {
    const { error } = await input.client
      .from('workspace_dashboard_shortcuts')
      .upsert(
        {
          user_id: input.userId,
          account_id: input.workspace.id,
          mobile_nav_shortcuts: parsed.data,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,account_id' },
      );

    if (error) {
      throw new Error(error.message);
    }
  }

  return loadNativePins(input.client, input.userId, input.workspace);
}
