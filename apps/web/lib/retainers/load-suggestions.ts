import type { SupabaseClient } from '@supabase/supabase-js';

import { mapMatchSuggestion, mapRetainerService } from './map-records';
import type { RetainerMatchSuggestion, RetainerServiceRecord } from './types';

function db(client: SupabaseClient) {
  return client as any;
}

export async function loadPendingRetainerSuggestions(
  client: SupabaseClient,
  actionItemIds: string[],
): Promise<Map<string, RetainerMatchSuggestion>> {
  const result = new Map<string, RetainerMatchSuggestion>();
  if (actionItemIds.length === 0) return result;

  const { data, error } = await db(client)
    .from('retainer_match_suggestions')
    .select('*')
    .in('email_action_item_id', actionItemIds)
    .eq('status', 'pending');

  if (error || !data) return result;

  const serviceIds = [
    ...new Set(
      (data as Array<{ service_id: string | null }>)
        .map((row) => row.service_id)
        .filter((id): id is string => Boolean(id)),
    ),
  ];

  const names = new Map<string, string>();
  if (serviceIds.length > 0) {
    const { data: services } = await db(client)
      .from('retainer_services')
      .select('id, name')
      .in('id', serviceIds);
    for (const service of services ?? []) {
      names.set(String(service.id), String(service.name));
    }
  }

  for (const row of data as Array<Record<string, unknown>>) {
    const actionItemId = row.email_action_item_id
      ? String(row.email_action_item_id)
      : null;
    if (!actionItemId) continue;
    result.set(
      actionItemId,
      mapMatchSuggestion(
        row,
        row.service_id ? (names.get(String(row.service_id)) ?? null) : null,
      ),
    );
  }

  return result;
}

export async function loadRetainerCatalogue(
  client: SupabaseClient,
  accountId: string,
): Promise<RetainerServiceRecord[]> {
  const { data, error } = await db(client)
    .from('retainer_services')
    .select('*')
    .eq('account_id', accountId)
    .eq('is_active', true)
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true });

  if (error || !data) return [];
  return (data as Array<Record<string, unknown>>).map(mapRetainerService);
}
