import 'server-only';

import { supabaseCustomSchema } from '~/lib/supabase-custom-schema';

import { fetchAllGscSearchAnalytics } from './client';
import {
  getValidGscAccessToken,
  loadGscConnection,
  markGscSyncResult,
} from './connection';
import {
  defaultGscEndDate,
  defaultGscStartDate,
  normalizeSearchQuery,
} from './domain';
import type { GscConnectionRow } from './types';

function db(client: unknown) {
  return supabaseCustomSchema(client, 'rankly');
}

async function upsertQueryMetrics(
  client: unknown,
  projectId: string,
  rows: Array<{
    query: string;
    queryNormalized: string;
    metricDate: string;
    clicks: number;
    impressions: number;
    ctr: number;
    position: number;
  }>,
) {
  if (rows.length === 0) return;

  const chunkSize = 500;
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize).map((row) => ({
      project_id: projectId,
      query: row.query,
      query_normalized: row.queryNormalized,
      metric_date: row.metricDate,
      clicks: row.clicks,
      impressions: row.impressions,
      ctr: row.ctr,
      position: row.position,
      updated_at: new Date().toISOString(),
    }));

    const { error } = await db(client).from('gsc_query_metrics').upsert(chunk, {
      onConflict: 'project_id,query_normalized,metric_date',
    });

    if (error) {
      throw new Error(error.message);
    }
  }
}

export async function syncProjectGscMetrics(
  client: unknown,
  projectId: string,
  options?: { days?: number },
): Promise<{
  rowsUpserted: number;
  startDate: string;
  endDate: string;
  propertyUri: string;
}> {
  const connection = await loadGscConnection(client, projectId);
  if (!connection) {
    throw new Error('Google Search Console is not connected');
  }
  if (!connection.property_uri) {
    throw new Error('Select a Search Console property before syncing');
  }

  return syncGscConnection(client, connection, options);
}

export async function syncGscConnection(
  client: unknown,
  connection: GscConnectionRow,
  options?: { days?: number },
): Promise<{
  rowsUpserted: number;
  startDate: string;
  endDate: string;
  propertyUri: string;
}> {
  if (!connection.property_uri) {
    throw new Error('Select a Search Console property before syncing');
  }

  const endDate = defaultGscEndDate();
  const startDate = defaultGscStartDate(endDate, options?.days ?? 28);

  try {
    const accessToken = await getValidGscAccessToken(client, connection);
    const rows = await fetchAllGscSearchAnalytics({
      accessToken,
      siteUrl: connection.property_uri,
      startDate,
      endDate,
    });

    const normalized = rows.map((row) => ({
      ...row,
      queryNormalized: normalizeSearchQuery(row.query),
    }));

    await upsertQueryMetrics(client, connection.project_id, normalized);
    await markGscSyncResult(client, connection.id, {
      ok: true,
      syncFromDate: startDate,
    });

    return {
      rowsUpserted: normalized.length,
      startDate,
      endDate,
      propertyUri: connection.property_uri,
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Search Console sync failed';
    await markGscSyncResult(client, connection.id, {
      ok: false,
      error: message,
    });
    throw error;
  }
}
