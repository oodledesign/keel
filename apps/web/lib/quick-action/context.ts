import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import { loadWorkspaceSwitcherAccounts } from '~/home/_lib/server/workspace-switcher.loader';

import type { QuickActionPageContext, WorkspaceSummary } from './types';

export type QuickActionContext = {
  userId: string;
  client: SupabaseClient;
  pageContext: QuickActionPageContext;
  workspaces: WorkspaceSummary[];
};

export async function createQuickActionContext(
  client: SupabaseClient,
  userId: string,
  pageContext: QuickActionPageContext = {},
): Promise<QuickActionContext> {
  const switcher = await loadWorkspaceSwitcherAccounts(client, userId);
  const workspaces: WorkspaceSummary[] = switcher.map((w) => ({
    id: w.id,
    name: w.label,
    slug: w.slug,
    typeLabel: w.typeLabel,
  }));

  return {
    userId,
    client,
    pageContext,
    workspaces,
  };
}

export function workspaceById(
  ctx: QuickActionContext,
  accountId: string,
): WorkspaceSummary | undefined {
  return ctx.workspaces.find((w) => w.id === accountId);
}

export function workspaceBySlugOrName(
  ctx: QuickActionContext,
  query: string,
): WorkspaceSummary | undefined {
  const q = query.trim().toLowerCase();
  if (!q) return undefined;

  const exactSlug = ctx.workspaces.find((w) => w.slug.toLowerCase() === q);
  if (exactSlug) return exactSlug;

  const exactName = ctx.workspaces.find((w) => w.name.toLowerCase() === q);
  if (exactName) return exactName;

  const partial = ctx.workspaces.find(
    (w) =>
      w.name.toLowerCase().includes(q) ||
      w.slug.toLowerCase().includes(q) ||
      q.includes(w.name.toLowerCase()),
  );
  return partial;
}
