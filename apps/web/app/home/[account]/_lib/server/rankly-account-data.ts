import 'server-only';

import { cache } from 'react';

import { getSupabaseServerClient } from '@kit/supabase/server-client';

import { createClientsService } from '../../clients/_lib/server/clients.service';
import { createWebsitesService } from '../../websites/_lib/server/websites.service';
import { supabaseCustomSchema } from '~/lib/supabase-custom-schema';
import type { RanklyClientImportOption } from '~/lib/rankly/client-import';
import {
  buildRanklyClientImportOptions,
  buildRanklyImportSeedForClient,
} from '~/lib/rankly/client-import';

export type { RanklyClientImportOption };

export type RanklyProjectRow = {
  id: string;
  name: string;
  domain: string;
  locale: string | null;
  client_id: string | null;
  target_country: string;
  created_at: string;
};

export type RanklyAlertRow = {
  id: string;
  alert_type: string;
  threshold: number | null;
  is_active: boolean;
  created_at: string;
  keyword_id: string;
};

export type RanklyResearchCacheRow = {
  id: string;
  seed_keyword: string;
  country: string;
  language: string;
  cached_at: string;
  expires_at: string;
};

export const loadRanklyProjectsForTeam = cache(
  async (accountId: string): Promise<RanklyProjectRow[]> => {
    const client = getSupabaseServerClient();
    const { data, error } = await supabaseCustomSchema(client, 'rankly')
      .from('projects')
      .select('id, name, domain, locale, client_id, target_country, created_at')
      .eq('account_id', accountId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[rankly] projects', error.message);
      return [];
    }
    return (data ?? []) as RanklyProjectRow[];
  },
);

export const loadRanklyAlertsForTeam = cache(
  async (accountId: string): Promise<RanklyAlertRow[]> => {
    const client = getSupabaseServerClient();
    const { data: projects, error: pe } = await supabaseCustomSchema(
      client,
      'rankly',
    )
      .from('projects')
      .select('id')
      .eq('account_id', accountId);

    if (pe || !projects?.length) {
      return [];
    }

    const projectIds = projects.map((p: { id: string }) => p.id);
    const { data: keywords, error: ke } = await supabaseCustomSchema(
      client,
      'rankly',
    )
      .from('keywords')
      .select('id')
      .in('project_id', projectIds);

    if (ke || !keywords?.length) {
      return [];
    }

    const keywordIds = keywords.map((k: { id: string }) => k.id);
    const { data: alerts, error: ae } = await supabaseCustomSchema(
      client,
      'rankly',
    )
      .from('alerts')
      .select('id, alert_type, threshold, is_active, created_at, keyword_id')
      .in('keyword_id', keywordIds)
      .order('created_at', { ascending: false });

    if (ae) {
      console.error('[rankly] alerts', ae.message);
      return [];
    }
    return (alerts ?? []) as RanklyAlertRow[];
  },
);

/** Global cache table; RLS allows read for authenticated users. */
export const loadRanklyResearchCacheSample = cache(
  async (limit: number): Promise<RanklyResearchCacheRow[]> => {
    const client = getSupabaseServerClient();
    const { data, error } = await supabaseCustomSchema(client, 'rankly')
      .from('keyword_research_cache')
      .select('id, seed_keyword, country, language, cached_at, expires_at')
      .order('cached_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('[rankly] keyword_research_cache', error.message);
      return [];
    }
    return (data ?? []) as RanklyResearchCacheRow[];
  },
);

export type RanklyKeywordRow = {
  id: string;
  project_id: string;
  keyword: string;
  search_engine: string;
  device: string;
  created_at: string;
};

export const loadRanklyProjectForTeam = cache(
  async (
    projectId: string,
    accountId: string,
  ): Promise<RanklyProjectRow | null> => {
    const client = getSupabaseServerClient();
    const { data, error } = await supabaseCustomSchema(client, 'rankly')
      .from('projects')
      .select('id, name, domain, locale, client_id, target_country, created_at')
      .eq('id', projectId)
      .eq('account_id', accountId)
      .maybeSingle();

    if (error) {
      console.error('[rankly] project', error.message);
      return null;
    }
    return data as RanklyProjectRow | null;
  },
);

export const loadRanklyKeywordsForProject = cache(
  async (
    projectId: string,
    accountId: string,
  ): Promise<RanklyKeywordRow[]> => {
    const project = await loadRanklyProjectForTeam(projectId, accountId);
    if (!project) {
      return [];
    }

    const client = getSupabaseServerClient();
    const { data, error } = await supabaseCustomSchema(client, 'rankly')
      .from('keywords')
      .select('id, project_id, keyword, search_engine, device, created_at')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[rankly] keywords', error.message);
      return [];
    }
    return (data ?? []) as RanklyKeywordRow[];
  },
);

export const loadRanklyKeywordCountsByProject = cache(
  async (accountId: string): Promise<Record<string, number>> => {
    const client = getSupabaseServerClient();
    const projects = await loadRanklyProjectsForTeam(accountId);
    if (!projects.length) {
      return {};
    }

    const { data: keywords, error } = await supabaseCustomSchema(
      client,
      'rankly',
    )
      .from('keywords')
      .select('id, project_id')
      .in(
        'project_id',
        projects.map((p) => p.id),
      );

    if (error || !keywords) {
      return {};
    }

    const counts: Record<string, number> = {};
    for (const k of keywords) {
      const pid = k.project_id as string;
      counts[pid] = (counts[pid] ?? 0) + 1;
    }
    return counts;
  },
);

export const loadRanklyClientImportOptions = cache(
  async (accountId: string): Promise<RanklyClientImportOption[]> => {
    const client = getSupabaseServerClient();

    try {
      const clientsService = createClientsService(client);
      const { data: clients } = await clientsService.listClients({
        accountId,
        page: 1,
        pageSize: 500,
      });

      if (!clients?.length) {
        return [];
      }

      let websites: Array<{
        domain: string | null;
        clientOrgId: string | null;
        linkedClientId: string | null;
      }> = [];

      try {
        const websitesService = createWebsitesService(client);
        const rows = await websitesService.listWebsites({ accountId });
        websites = rows.map((row) => ({
          domain: row.domain,
          clientOrgId: row.clientOrgId,
          linkedClientId: row.linkedClientId,
        }));
      } catch (err) {
        console.error('[rankly] websites for client import', err);
      }

      return buildRanklyClientImportOptions(
        client,
        accountId,
        clients,
        websites,
      );
    } catch (err) {
      console.error('[rankly] client import options', err);
      return [];
    }
  },
);

export const loadRanklyImportSeedForClient = cache(
  async (
    accountId: string,
    clientId: string,
  ): Promise<RanklyClientImportOption | null> => {
    const options = await loadRanklyClientImportOptions(accountId);
    return options.find((option) => option.clientId === clientId) ?? null;
  },
);

export const loadRanklyProjectForClient = cache(
  async (
    accountId: string,
    clientId: string,
  ): Promise<RanklyProjectRow | null> => {
    const client = getSupabaseServerClient();
    const { data, error } = await supabaseCustomSchema(client, 'rankly')
      .from('projects')
      .select('id, name, domain, locale, client_id, target_country, created_at')
      .eq('account_id', accountId)
      .eq('client_id', clientId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error('[rankly] project for client', error.message);
      return null;
    }
    return data as RanklyProjectRow | null;
  },
);
