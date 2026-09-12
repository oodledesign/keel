import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import { isInsufficientCreditsError } from '~/lib/ai/router';
import { buildThreadText } from '~/lib/email-assistant/thread-text';

import { applyRetainerMatch } from './apply-match';
import { looseClient } from './loose-client';
import { mapRetainerService } from './map-records';
import { mapMatchSuggestion } from './map-records';
import { matchRetainerServiceWithFlash } from './match-ai';
import {
  canAutoApply,
  resolveMatchKind,
  splitServicePools,
  suggestedCreditCost,
} from './match-ladder';
import type { LadderService, RetainerMatchSuggestion } from './types';

function db(client: SupabaseClient) {
  return looseClient(client);
}

function toLadderService(
  row: ReturnType<typeof mapRetainerService>,
): LadderService {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    creditCost: row.creditCost,
  };
}

export async function suggestRetainerMatchForActionItem(input: {
  admin: SupabaseClient;
  actionItemId: string;
  actorUserId?: string | null;
}): Promise<RetainerMatchSuggestion | null> {
  const { data: item, error: itemError } = await db(input.admin)
    .from('email_action_items')
    .select(
      'id, title, detail, source_excerpt, user_id, thread_id, account_id, client_id, project_id, status, suggested_assignee_id, suggested_due_date, suggested_duration_minutes',
    )
    .eq('id', input.actionItemId)
    .maybeSingle();

  if (itemError) {
    throw new Error(itemError.message);
  }

  if (
    !item ||
    item.status !== 'suggested' ||
    !item.project_id ||
    !item.account_id
  ) {
    return null;
  }

  const { data: existing } = await db(input.admin)
    .from('retainer_match_suggestions')
    .select('*')
    .eq('email_action_item_id', item.id)
    .eq('status', 'pending')
    .maybeSingle();

  if (existing) {
    return mapMatchSuggestion(existing as Record<string, unknown>);
  }

  const [projectRow, catalogueRows, allowRows, usedRows, messages] =
    await Promise.all([
      db(input.admin)
        .from('projects')
        .select('id, account_id, name, title, client_id')
        .eq('id', item.project_id)
        .maybeSingle(),
      db(input.admin)
        .from('retainer_services')
        .select('*')
        .eq('account_id', item.account_id)
        .eq('is_active', true)
        .order('sort_order', { ascending: true }),
      db(input.admin)
        .from('project_retainer_services')
        .select('service_id')
        .eq('project_id', item.project_id),
      db(input.admin)
        .from('project_retainer_transactions')
        .select('service_id')
        .eq('project_id', item.project_id)
        .eq('type', 'burn')
        .not('service_id', 'is', null),
      item.thread_id
        ? db(input.admin)
            .from('email_messages')
            .select('from_address, subject, body_text, snippet, internal_date')
            .eq('thread_id', item.thread_id)
            .order('internal_date', { ascending: true, nullsFirst: false })
        : Promise.resolve({ data: [] }),
    ]);

  const project = projectRow.data as {
    id: string;
    account_id: string;
    name?: string | null;
    title?: string | null;
    client_id?: string | null;
  } | null;

  if (!project) return null;

  const catalogue = (
    (catalogueRows.data ?? []) as Array<Record<string, unknown>>
  )
    .map(mapRetainerService)
    .map(toLadderService);

  const allowlistIds = (
    (allowRows.data ?? []) as Array<{ service_id: string }>
  ).map((row) => row.service_id);
  const previouslyUsedIds = [
    ...new Set(
      ((usedRows.data ?? []) as Array<{ service_id: string | null }>)
        .map((row) => row.service_id)
        .filter((id): id is string => Boolean(id)),
    ),
  ];

  const pools = splitServicePools({
    catalogue,
    allowlistIds,
    previouslyUsedIds,
  });

  const { data: thread } = item.thread_id
    ? await db(input.admin)
        .from('email_threads')
        .select('subject')
        .eq('id', item.thread_id)
        .maybeSingle()
    : { data: null };

  const subject = (thread?.subject as string | null) ?? item.title ?? '';

  const emailText = [
    item.title,
    item.detail,
    item.source_excerpt,
    buildThreadText(
      (messages.data ?? []) as Array<{
        from_address: string | null;
        subject: string | null;
        body_text: string | null;
        snippet: string | null;
        internal_date: string | null;
      }>,
    ),
  ]
    .filter(Boolean)
    .join('\n\n');

  let ai;
  try {
    ai = await matchRetainerServiceWithFlash({
      accountId: String(item.account_id),
      supabase: input.admin,
      subject: String(subject),
      emailText,
      pools,
    });
  } catch (error) {
    if (isInsufficientCreditsError(error)) {
      throw error;
    }
    ai = {
      serviceId: null,
      confidence: 0,
      rationale: 'Matching was unavailable. Review this email manually.',
      proposedName: null,
      proposedDescription: null,
      proposedCreditCost: null,
    };
  }

  const projectServiceIds = new Set(pools.projectServices.map((row) => row.id));
  const workspaceServiceIds = new Set(
    pools.workspaceOnlyServices.map((row) => row.id),
  );
  const matchKind = resolveMatchKind({
    serviceId: ai.serviceId ?? null,
    confidence: ai.confidence,
    proposedName: ai.proposedName,
    projectServiceIds,
    workspaceServiceIds,
  });

  const matchedService =
    matchKind === 'project_service' || matchKind === 'workspace_service'
      ? (catalogue.find((row) => row.id === ai.serviceId) ?? null)
      : null;

  const creditCost = suggestedCreditCost({
    matchKind,
    serviceCost: matchedService?.creditCost,
    proposedCost: ai.proposedCreditCost,
  });

  const { data: inserted, error: insertError } = await db(input.admin)
    .from('retainer_match_suggestions')
    .insert({
      account_id: item.account_id,
      project_id: item.project_id,
      client_id: item.client_id ?? project.client_id ?? null,
      email_thread_id: item.thread_id,
      email_action_item_id: item.id,
      match_kind: matchKind,
      service_id: matchedService?.id ?? null,
      proposed_name:
        matchKind === 'propose_new' ? ai.proposedName?.trim() || null : null,
      proposed_description:
        matchKind === 'propose_new'
          ? ai.proposedDescription?.trim() || null
          : null,
      proposed_credit_cost: matchKind === 'propose_new' ? creditCost : null,
      confidence: ai.confidence,
      rationale: ai.rationale,
      credit_cost: creditCost,
      status: 'pending',
    })
    .select('*')
    .single();

  if (insertError || !inserted) {
    if (insertError?.code === '23505') {
      const { data: raced } = await db(input.admin)
        .from('retainer_match_suggestions')
        .select('*')
        .eq('email_action_item_id', item.id)
        .eq('status', 'pending')
        .maybeSingle();
      return raced
        ? mapMatchSuggestion(raced as Record<string, unknown>)
        : null;
    }
    throw new Error(insertError?.message ?? 'Could not store match suggestion');
  }

  const suggestion = mapMatchSuggestion(
    inserted as Record<string, unknown>,
    matchedService?.name,
  );

  const { data: retainer } = await db(input.admin)
    .from('project_retainers')
    .select('credit_balance, auto_match_enabled')
    .eq('project_id', item.project_id)
    .maybeSingle();

  if (
    canAutoApply({
      autoMatchEnabled: Boolean(retainer?.auto_match_enabled),
      matchKind,
      confidence: ai.confidence,
      creditCost: creditCost ?? 0,
      balance: Number(retainer?.credit_balance ?? 0),
    })
  ) {
    try {
      await applyRetainerMatch({
        admin: input.admin,
        suggestionId: suggestion.id,
        mode: 'auto',
        actorUserId: input.actorUserId ?? String(item.user_id),
      });
    } catch (error) {
      console.warn('[retainer] auto-apply failed', {
        suggestionId: suggestion.id,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return suggestion;
}

export async function suggestRetainerMatchesForInsertedItems(input: {
  admin: SupabaseClient;
  actionItemIds: string[];
  actorUserId?: string | null;
}) {
  await Promise.all(
    input.actionItemIds.map(async (actionItemId) => {
      try {
        await suggestRetainerMatchForActionItem({
          admin: input.admin,
          actionItemId,
          actorUserId: input.actorUserId,
        });
      } catch (error) {
        console.warn('[retainer] match failed', {
          actionItemId,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }),
  );
}
