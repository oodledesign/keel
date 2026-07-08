'use server';

import { revalidatePath } from 'next/cache';

import { suggestActivityAssignments } from '~/lib/ai/activity-assignment-suggest';
import { getActivitySupabaseClient } from '~/lib/activity/activity-supabase';

import {
  bulkUpdateActivityBlocksAction,
  createActivityRuleAction,
} from './activity-blocks-actions';

type SuggestActivityAssignmentsInput = {
  accountId: string;
  accountSlug: string;
  blockIds: string[];
};

export async function suggestActivityAssignmentsAction(
  input: SuggestActivityAssignmentsInput,
): Promise<{
  success: boolean;
  suggestions?: Array<{
    blockId: string;
    clientId: string | null;
    projectId: string | null;
    confidence: 'high' | 'medium' | 'low';
    reason?: string;
  }>;
  error?: string;
}> {
  const blockIds = [...new Set(input.blockIds.map((id) => id.trim()).filter(Boolean))];

  if (blockIds.length === 0) {
    return { success: false, error: 'No activity blocks selected' };
  }

  const client = getActivitySupabaseClient();
  const { data: auth } = await client.auth.getUser();
  const userId = auth.user?.id;

  if (!userId) {
    return { success: false, error: 'Not authenticated' };
  }

  const [blocksResult, projectsResult, clientsResult] = await Promise.all([
    client
      .from('activity_blocks')
      .select(
        'id, app_name, domain, url, window_title, duration_seconds, is_excluded',
      )
      .eq('account_id', input.accountId)
      .eq('user_id', userId)
      .in('id', blockIds),
    client
      .from('projects')
      .select('id, name, title, client_id')
      .eq('account_id', input.accountId)
      .eq('project_type', 'delivery')
      .limit(200),
    client
      .from('clients')
      .select('id, display_name, company_name')
      .eq('account_id', input.accountId)
      .limit(100),
  ]);

  if (blocksResult.error) {
    return { success: false, error: blocksResult.error.message };
  }

  const blocks = (blocksResult.data ?? []).filter((row) => !row.is_excluded);

  const suggestions = await suggestActivityAssignments({
    clients: (clientsResult.data ?? []).map((row) => ({
      id: row.id as string,
      name:
        (row.display_name as string | null)?.trim() ||
        (row.company_name as string | null)?.trim() ||
        'Client',
    })),
    projects: (projectsResult.data ?? []).map((row) => ({
      id: row.id as string,
      name:
        (row.title as string | null)?.trim() ||
        (row.name as string | null)?.trim() ||
        'Project',
      clientId: (row.client_id as string | null) ?? null,
    })),
    blocks: blocks.map((row) => ({
      id: row.id as string,
      appName: row.app_name as string,
      domain: (row.domain as string | null) ?? null,
      url: (row.url as string | null) ?? null,
      windowTitle: row.window_title as string,
      durationSeconds: row.duration_seconds as number,
    })),
  });

  return { success: true, suggestions };
}

export async function applyActivitySuggestionsAction(input: {
  accountId: string;
  accountSlug: string;
  suggestions: Array<{
    blockId: string;
    clientId: string | null;
    projectId: string | null;
    confidence?: 'high' | 'medium' | 'low';
  }>;
  rememberRules?: boolean;
}): Promise<{ success: boolean; applied: number; error?: string }> {
  const applicable = input.suggestions.filter((s) => s.clientId || s.projectId);

  if (applicable.length === 0) {
    return { success: false, applied: 0, error: 'No applicable suggestions' };
  }

  const groups = new Map<
    string,
    { clientId: string | null; projectId: string | null; blockIds: string[] }
  >();

  for (const suggestion of applicable) {
    const key = `${suggestion.clientId ?? ''}:${suggestion.projectId ?? ''}`;
    const existing = groups.get(key) ?? {
      clientId: suggestion.clientId,
      projectId: suggestion.projectId,
      blockIds: [],
    };
    existing.blockIds.push(suggestion.blockId);
    groups.set(key, existing);
  }

  let applied = 0;

  for (const group of groups.values()) {
    const result = await bulkUpdateActivityBlocksAction({
      accountId: input.accountId,
      accountSlug: input.accountSlug,
      blockIds: group.blockIds,
      clientId: group.clientId,
      projectId: group.projectId,
      isConfirmed: false,
    });

    if (!result.success) {
      return { success: false, applied, error: result.error };
    }

    applied += group.blockIds.length;
  }

  if (input.rememberRules && applicable.length > 0) {
    const client = getActivitySupabaseClient();
    const blockIds = applicable.map((suggestion) => suggestion.blockId);
    const { data: samples } = await client
      .from('activity_blocks')
      .select('id, app_name, domain, url, window_title')
      .eq('account_id', input.accountId)
      .in('id', blockIds);

    const rulesCreated = new Set<string>();

    for (const suggestion of applicable) {
      const sample = (samples ?? []).find((row) => row.id === suggestion.blockId);
      if (!sample) {
        continue;
      }

      let ruleKey: string | null = null;
      let rule:
        | {
            matchType: 'domain' | 'app_name' | 'title_contains' | 'url_path';
            matchValue: string;
          }
        | null = null;

      if (sample.domain) {
        rule = {
          matchType: 'domain',
          matchValue: String(sample.domain),
        };
        ruleKey = `${rule.matchType}:${rule.matchValue}:${suggestion.clientId ?? ''}:${suggestion.projectId ?? ''}`;
      } else if (sample.url) {
        try {
          const parsed = new URL(String(sample.url));
          const host = parsed.hostname.replace(/^www\./i, '').toLowerCase();
          const path =
            parsed.pathname === '/'
              ? ''
              : parsed.pathname.replace(/\/$/, '');
          const normalized = `${host}${path}`;
          if (normalized.includes('/')) {
            rule = {
              matchType: 'url_path',
              matchValue: normalized,
            };
            ruleKey = `${rule.matchType}:${rule.matchValue}:${suggestion.clientId ?? ''}:${suggestion.projectId ?? ''}`;
          }
        } catch {
          // ignore invalid URLs
        }
      } else if (sample.window_title) {
        const title = String(sample.window_title).split(' - ')[0]?.trim();
        if (title && title.length > 2) {
          rule = {
            matchType: 'title_contains',
            matchValue: title,
          };
          ruleKey = `${rule.matchType}:${rule.matchValue}:${suggestion.clientId ?? ''}:${suggestion.projectId ?? ''}`;
        }
      } else if (sample.app_name) {
        rule = {
          matchType: 'app_name',
          matchValue: String(sample.app_name),
        };
        ruleKey = `${rule.matchType}:${rule.matchValue}:${suggestion.clientId ?? ''}:${suggestion.projectId ?? ''}`;
      }

      if (!rule || !ruleKey || rulesCreated.has(ruleKey)) {
        continue;
      }

      await createActivityRuleAction({
        accountId: input.accountId,
        accountSlug: input.accountSlug,
        matchType: rule.matchType,
        matchValue: rule.matchValue,
        clientId: suggestion.clientId,
        projectId: suggestion.projectId,
        backfill: false,
      });
      rulesCreated.add(ruleKey);
    }
  }

  return { success: true, applied };
}
