import 'server-only';

import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

import { assertWorkspaceMember } from '~/lib/api-tokens/assert-workspace-member';

const MAX_TEXT_BYTES = 32 * 1024;

export type DictationHistoryItem = {
  id: string;
  text: string;
  character_count: number;
  paste_mode: boolean;
  account_id: string | null;
  created_at: string;
};

export async function saveDictationHistory(params: {
  userId: string;
  text: string;
  accountId?: string | null;
  pasteMode?: boolean;
  createdAt?: string;
}): Promise<{ id: string; created_at: string }> {
  const trimmed = params.text.trim();
  if (!trimmed) {
    throw new Error('Text is required.');
  }

  const byteLength = Buffer.byteLength(trimmed, 'utf8');
  if (byteLength > MAX_TEXT_BYTES) {
    throw new Error('Dictation text is too long.');
  }

  if (params.accountId) {
    const admin = getSupabaseServerAdminClient();
    await assertWorkspaceMember(admin, params.accountId, params.userId);
  }

  const admin = getSupabaseServerAdminClient();
  const { data, error } = await admin
    .from('dictation_history')
    .insert({
      user_id: params.userId,
      account_id: params.accountId ?? null,
      text: trimmed,
      character_count: [...trimmed].length,
      paste_mode: params.pasteMode ?? false,
      source: 'desktop_dictation',
      ...(params.createdAt ? { created_at: params.createdAt } : {}),
    })
    .select('id, created_at')
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? 'Failed to save dictation.');
  }

  return data;
}

export async function listDictationHistory(params: {
  userId: string;
  limit?: number;
}): Promise<DictationHistoryItem[]> {
  const limit = Math.min(Math.max(params.limit ?? 50, 1), 200);
  const admin = getSupabaseServerAdminClient();

  const { data, error } = await admin
    .from('dictation_history')
    .select('id, text, character_count, paste_mode, account_id, created_at')
    .eq('user_id', params.userId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as DictationHistoryItem[];
}
