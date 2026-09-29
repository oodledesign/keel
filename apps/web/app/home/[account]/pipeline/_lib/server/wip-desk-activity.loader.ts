import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import type {
  WipDeskActivityItem,
  WipPersonRef,
} from './wip-attachments.actions';

type NoteRow = {
  id: string;
  content: string | null;
  created_at: string | null;
  updated_at: string | null;
  created_by: string | null;
  assigned_to: string | null;
  pipeline_deal_id: string | null;
  commercial_requirement_id: string | null;
};

async function resolveNames(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  client: any,
  userIds: string[],
): Promise<Map<string, string>> {
  const unique = [...new Set(userIds.filter(Boolean))];
  const map = new Map<string, string>();
  if (unique.length === 0) return map;

  const { data } = await client
    .from('accounts')
    .select('id, name')
    .in('id', unique);

  for (const row of (data ?? []) as Array<{
    id: string;
    name?: string | null;
  }>) {
    map.set(row.id, row.name?.trim() || 'Member');
  }
  for (const id of unique) {
    if (!map.has(id)) map.set(id, 'Member');
  }
  return map;
}

function person(
  id: string | null,
  names: Map<string, string>,
): WipPersonRef | null {
  if (!id) return null;
  return { id, name: names.get(id) ?? 'Member' };
}

/** Server-side desk activity for commercial WIP page first paint. */
export async function loadWipDeskActivity(
  client: SupabaseClient,
  accountId: string,
  limit = 30,
): Promise<WipDeskActivityItem[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = client as any;
  const { data, error } = await db
    .from('notes')
    .select(
      'id, content, created_at, updated_at, created_by, assigned_to, pipeline_deal_id, commercial_requirement_id',
    )
    .eq('account_id', accountId)
    .not('pipeline_deal_id', 'is', null)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('[wip] desk activity load failed', error.message);
    return [];
  }

  const allRows = (data ?? []) as NoteRow[];
  const dealIds = [
    ...new Set(
      allRows
        .map((row) => row.pipeline_deal_id)
        .filter((id): id is string => Boolean(id)),
    ),
  ];

  const titleByDeal = new Map<string, string>();
  // Updates on an archived instruction stay out of the desk feed.
  const archivedDealIds = new Set<string>();
  if (dealIds.length > 0) {
    const { data: deals } = await db
      .from('pipeline_deals')
      .select('id, name, company_name, contact_name, archived_at')
      .in('id', dealIds);

    for (const deal of (deals ?? []) as Array<{
      id: string;
      name?: string | null;
      company_name?: string | null;
      contact_name?: string | null;
      archived_at?: string | null;
    }>) {
      if (deal.archived_at) archivedDealIds.add(deal.id);
      titleByDeal.set(
        deal.id,
        deal.name?.trim() ||
          deal.company_name?.trim() ||
          deal.contact_name?.trim() ||
          'Instruction',
      );
    }
  }

  const rows = allRows.filter(
    (row) =>
      !row.pipeline_deal_id || !archivedDealIds.has(row.pipeline_deal_id),
  );

  const names = await resolveNames(
    db,
    rows.flatMap(
      (row) => [row.created_by, row.assigned_to].filter(Boolean) as string[],
    ),
  );

  return rows.map((row) => ({
    id: row.id,
    content: (row.content ?? '').replace(/^\[import_key:[^\]]+\]\n?/, ''),
    createdAt: row.created_at ?? row.updated_at ?? new Date().toISOString(),
    createdBy: person(row.created_by, names),
    assignedTo: person(row.assigned_to, names),
    pipelineDealId: row.pipeline_deal_id,
    commercialRequirementId: row.commercial_requirement_id,
    instructionTitle: row.pipeline_deal_id
      ? (titleByDeal.get(row.pipeline_deal_id) ?? 'Instruction')
      : null,
  }));
}

/**
 * Date of the newest update on each instruction, for the collapsed ladder
 * row. Grouped in the database so it covers every instruction, not just the
 * few recent enough to be in the desk activity feed.
 */
export async function loadLatestWipUpdateByDeal(
  client: SupabaseClient,
  accountId: string,
): Promise<Record<string, string>> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = client as any;
  const { data, error } = await db.rpc('latest_wip_update_by_deal', {
    p_account_id: accountId,
  });

  if (error) {
    console.error('[wip] latest update by deal failed', error.message);
    return {};
  }

  const map: Record<string, string> = {};
  for (const row of (data ?? []) as Array<{
    pipeline_deal_id: string;
    latest_at: string;
  }>) {
    map[row.pipeline_deal_id] = row.latest_at;
  }
  return map;
}
