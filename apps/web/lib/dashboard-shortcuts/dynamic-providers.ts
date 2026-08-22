import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import pathsConfig from '~/config/paths.config';
import {
  isAccountModuleEnabled,
  isRanklyModuleEnabled,
} from '~/home/[account]/_lib/server/account-modules';
import type { WorkspaceProfile } from '~/home/[account]/_lib/workspace-profile';
import { resolveClientListTitle } from '~/lib/clients/resolve-client-list-display';
import {
  DELIVERY_PROJECT_FILTER,
  PROJECTS_TABLE,
} from '~/lib/projects/delivery-project-db';
import { deliveryProjectTitle } from '~/lib/projects/project-types';
import { supabaseCustomSchema } from '~/lib/supabase-custom-schema';

import { SHORTCUT_CATALOG_RANKLY_PROJECT } from './catalog-ids';
import { routeCatalogItem } from './resolve-href';
import type { ShortcutCatalogItem } from './types';

export type DynamicShortcutContext = {
  client: SupabaseClient;
  accountId: string;
  accountSlug: string;
  workspaceName: string;
  workspaceProfile?: WorkspaceProfile;
  moduleSettings: Record<string, boolean> | undefined;
};

export type DynamicShortcutProvider = {
  /** Stable id for logging / ordering */
  id: string;
  build: (ctx: DynamicShortcutContext) => Promise<ShortcutCatalogItem[]>;
};

const ENTITY_LIMIT = 120;

function accountPath(template: string, slug: string) {
  return template.replace('[account]', slug);
}

function compact(values: Array<string | null | undefined>): string[] {
  return values.map((value) => value?.trim() ?? '').filter(Boolean);
}

function entityItem(input: {
  ctx: DynamicShortcutContext;
  href: string;
  label: string;
  kind: string;
  keywords?: string[];
}): ShortcutCatalogItem | null {
  return routeCatalogItem({
    label: input.label,
    href: input.href,
    category: `${input.ctx.workspaceName} · ${input.kind}`,
    description: input.kind,
    keywords: [
      input.kind,
      input.label,
      input.ctx.workspaceName,
      input.ctx.accountSlug,
      ...(input.keywords ?? []),
    ],
  });
}

function clientKindLabel(profile: WorkspaceProfile | undefined): string {
  if (profile === 'commercial_property') return 'Contact';
  if (profile === 'work_property') return 'Tenant';
  return 'Client';
}

const clientsProvider: DynamicShortcutProvider = {
  id: 'workspace-clients',
  async build(ctx) {
    if (!isAccountModuleEnabled(ctx.moduleSettings, 'clients')) return [];

    const kind = clientKindLabel(ctx.workspaceProfile);
    const query = ctx.client
      .from('clients')
      .select(
        'id, display_name, company_name, first_name, last_name, email, client_type',
      )
      .eq('account_id', ctx.accountId)
      .is('archived_at', null)
      .order('updated_at', { ascending: false })
      .limit(ENTITY_LIMIT);

    let { data, error } = await query;

    if (error) {
      const fallback = await ctx.client
        .from('clients')
        .select(
          'id, display_name, company_name, first_name, last_name, email, client_type',
        )
        .eq('account_id', ctx.accountId)
        .order('created_at', { ascending: false })
        .limit(ENTITY_LIMIT);
      data = fallback.data;
      error = fallback.error;
    }

    if (error || !data?.length) return [];

    const items: ShortcutCatalogItem[] = [];
    for (const row of data as Array<{
      id: string;
      display_name: string | null;
      company_name: string | null;
      first_name: string | null;
      last_name: string | null;
      email: string | null;
      client_type: string | null;
    }>) {
      const label = resolveClientListTitle(row);
      const item = entityItem({
        ctx,
        kind,
        label,
        href: `${accountPath(pathsConfig.app.accountClients, ctx.accountSlug)}/${row.id}`,
        keywords: compact([
          'clients',
          'contacts',
          'tenant',
          row.company_name,
          row.email,
          row.first_name,
          row.last_name,
        ]),
      });
      if (item) items.push(item);
    }
    return items;
  },
};

const projectsProvider: DynamicShortcutProvider = {
  id: 'workspace-projects',
  async build(ctx) {
    if (!isAccountModuleEnabled(ctx.moduleSettings, 'jobs')) return [];

    const query = ctx.client
      .from(PROJECTS_TABLE)
      .select('id, title, name, project_type')
      .eq('account_id', ctx.accountId)
      .eq('project_type', DELIVERY_PROJECT_FILTER.project_type)
      .order('updated_at', { ascending: false })
      .limit(ENTITY_LIMIT);

    let { data, error } = await query;

    if (error) {
      const fallback = await ctx.client
        .from(PROJECTS_TABLE)
        .select('id, title, name, project_type')
        .eq('account_id', ctx.accountId)
        .eq('project_type', DELIVERY_PROJECT_FILTER.project_type)
        .order('created_at', { ascending: false })
        .limit(ENTITY_LIMIT);
      data = fallback.data;
      error = fallback.error;
    }

    if (error) {
      const legacy = await ctx.client
        .from(PROJECTS_TABLE)
        .select('id, title, name')
        .eq('account_id', ctx.accountId)
        .order('created_at', { ascending: false })
        .limit(ENTITY_LIMIT);
      data = legacy.data as typeof data;
      error = legacy.error;
    }

    if (error || !data?.length) return [];

    const items: ShortcutCatalogItem[] = [];
    for (const row of data as Array<{
      id: string;
      title?: string | null;
      name?: string | null;
      project_type?: string | null;
    }>) {
      const label = deliveryProjectTitle(row);
      const item = entityItem({
        ctx,
        kind: 'Project',
        label,
        href: accountPath(
          pathsConfig.app.accountJobDetail,
          ctx.accountSlug,
        ).replace('[id]', row.id),
        keywords: compact(['projects', 'jobs', row.project_type, row.name]),
      });
      if (item) items.push(item);
    }
    return items;
  },
};

function mapDisposalItems(
  ctx: DynamicShortcutContext,
  data: unknown[],
): ShortcutCatalogItem[] {
  const items: ShortcutCatalogItem[] = [];
  for (const row of data as Array<{
    id: string;
    name: string | null;
    town: string | null;
    postcode: string | null;
    address_line_1: string | null;
    sector: string | null;
  }>) {
    const label =
      row.name?.trim() || row.address_line_1?.trim() || 'Untitled disposal';
    const item = entityItem({
      ctx,
      kind: 'Disposal',
      label,
      href: accountPath(
        pathsConfig.app.accountListingDetail,
        ctx.accountSlug,
      ).replace('[id]', row.id),
      keywords: compact([
        'listings',
        'disposals',
        'property',
        row.town,
        row.postcode,
        row.address_line_1,
        row.sector,
      ]),
    });
    if (item) items.push(item);
  }
  return items;
}

const disposalsProvider: DynamicShortcutProvider = {
  id: 'workspace-disposals',
  async build(ctx) {
    if (!isAccountModuleEnabled(ctx.moduleSettings, 'listings')) return [];

    const { data, error } = await ctx.client
      .from('commercial_listings')
      .select('id, name, town, postcode, address_line_1, sector')
      .eq('account_id', ctx.accountId)
      .order('updated_at', { ascending: false })
      .limit(ENTITY_LIMIT);

    if (error) {
      const fallback = await ctx.client
        .from('commercial_listings')
        .select('id, name, town, postcode, address_line_1, sector')
        .eq('account_id', ctx.accountId)
        .order('created_at', { ascending: false })
        .limit(ENTITY_LIMIT);
      if (fallback.error || !fallback.data?.length) return [];
      return mapDisposalItems(ctx, fallback.data);
    }

    if (!data?.length) return [];
    return mapDisposalItems(ctx, data);
  },
};

const meetingsProvider: DynamicShortcutProvider = {
  id: 'workspace-meetings',
  async build(ctx) {
    if (!isAccountModuleEnabled(ctx.moduleSettings, 'clients')) return [];

    const { data, error } = await ctx.client
      .from('meeting_transcripts')
      .select('id, title, meeting_date')
      .eq('account_id', ctx.accountId)
      .order('created_at', { ascending: false })
      .limit(80);

    if (error || !data?.length) return [];

    const items: ShortcutCatalogItem[] = [];
    for (const row of data as Array<{
      id: string;
      title: string | null;
      meeting_date: string | null;
    }>) {
      const label = row.title?.trim() || 'Untitled meeting';
      const item = entityItem({
        ctx,
        kind: 'Meeting',
        label,
        href: accountPath(
          pathsConfig.app.accountMeetingDetail,
          ctx.accountSlug,
        ).replace('[transcriptId]', row.id),
        keywords: compact(['meetings', 'transcript', row.meeting_date]),
      });
      if (item) items.push(item);
    }
    return items;
  },
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

    return (
      data as Array<{ id: string; name: string; domain: string | null }>
    ).map((p) => ({
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
    }));
  },
};

/**
 * Register additional dynamic shortcut providers here when a feature exposes
 * sub-entities (projects, properties, etc.) beyond sidebar nav items.
 */
const DYNAMIC_SHORTCUT_PROVIDERS: DynamicShortcutProvider[] = [
  clientsProvider,
  projectsProvider,
  disposalsProvider,
  meetingsProvider,
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
