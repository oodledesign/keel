import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import { isRanklyModuleEnabled } from '~/home/[account]/_lib/server/account-modules';
import { supabaseCustomSchema } from '~/lib/supabase-custom-schema';

import { SHORTCUT_CATALOG_RANKLY_PROJECT } from './catalog-ids';
import type { ShortcutCatalogItem } from './types';

export type DynamicShortcutContext = {
  client: SupabaseClient;
  accountId: string;
  accountSlug: string;
  workspaceName: string;
  moduleSettings: Record<string, boolean> | undefined;
};

export type DynamicShortcutProvider = {
  /** Stable id for logging / ordering */
  id: string;
  build: (ctx: DynamicShortcutContext) => Promise<ShortcutCatalogItem[]>;
};

const ranklyProjectsProvider: DynamicShortcutProvider = {
  id: 'rankly-projects',
  async build(ctx) {
    if (!isRanklyModuleEnabled(ctx.moduleSettings)) return [];

    const { data, error } = await supabaseCustomSchema(ctx.client, 'rankly')
      .from('projects')
      .select('id, name, domain')
      .eq('account_id', ctx.accountId)
      .order('name', { ascending: true })
      .limit(50);

    if (error || !data?.length) return [];

    return (data as Array<{ id: string; name: string; domain: string | null }>).map(
      (p) => ({
        catalogId: SHORTCUT_CATALOG_RANKLY_PROJECT,
        label: `${ctx.workspaceName} — Rankly: ${p.name}`,
        description: p.domain
          ? `Track rankings for ${p.domain}`
          : 'Rank tracking project',
        category: `${ctx.workspaceName} · Rankly`,
        params: {
          accountSlug: ctx.accountSlug,
          projectId: p.id,
        },
        keywords: [
          'rankly',
          'seo',
          'rank',
          'tracking',
          p.name,
          p.domain ?? '',
          ctx.workspaceName,
        ].filter(Boolean),
      }),
    );
  },
};

/**
 * Register additional dynamic shortcut providers here when a feature exposes
 * sub-entities (projects, properties, etc.) beyond sidebar nav items.
 */
const DYNAMIC_SHORTCUT_PROVIDERS: DynamicShortcutProvider[] = [
  ranklyProjectsProvider,
];

export async function buildDynamicShortcutCatalog(
  ctx: DynamicShortcutContext,
): Promise<ShortcutCatalogItem[]> {
  const batches = await Promise.all(
    DYNAMIC_SHORTCUT_PROVIDERS.map((provider) => provider.build(ctx)),
  );
  return batches.flat();
}
