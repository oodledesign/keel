import { syncMailbox } from '@kit/gmail';
import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

import {
  CRON_KILL_SWITCH,
  cronSkippedResponse,
  isCronDisabled,
} from '~/lib/cron/cron-guards';
import { authorizeCron } from '~/lib/email-assistant/cron-auth';
import { runEmailAssistantPipeline } from '~/lib/email-assistant/post-sync-pipeline';
import { requireEmailAssistantApiUser } from '~/lib/email-assistant/require-email-assistant-api-user';
import { jsonErr, jsonOk } from '~/lib/rankly/api-response';

export const runtime = 'nodejs';
export const maxDuration = 120;
export const dynamic = 'force-dynamic';

const DEFAULT_GMAIL_SYNC_BATCH_SIZE = 8;

type SyncResultRow = {
  userId: string;
  ok: boolean;
  mode?: string;
  messagesProcessed?: number;
  assistant?: Awaited<ReturnType<typeof runEmailAssistantPipeline>>;
  error?: string;
};

async function syncUserMailbox(userId: string) {
  const syncResult = await syncMailbox(userId);
  const assistant = await runEmailAssistantPipeline(userId);

  return { ...syncResult, assistant };
}

async function syncAllConnectedUsers() {
  const admin = getSupabaseServerAdminClient();
  const batchSize = Math.max(
    1,
    Number(process.env.GMAIL_SYNC_BATCH_SIZE ?? DEFAULT_GMAIL_SYNC_BATCH_SIZE),
  );
  const { data, error } = await admin
    .from('google_connections')
    .select('user_id')
    .order('user_id', { ascending: true })
    .limit(batchSize);

  if (error) {
    throw new Error(error.message);
  }

  const results: SyncResultRow[] = [];

  for (const row of data ?? []) {
    const userId = (row as { user_id: string }).user_id;

    try {
      const result = await syncUserMailbox(userId);
      results.push({
        userId,
        ok: true,
        mode: result.mode,
        messagesProcessed: result.messagesProcessed,
        assistant: result.assistant ?? undefined,
      });
    } catch (syncError) {
      results.push({
        userId,
        ok: false,
        error: syncError instanceof Error ? syncError.message : 'Sync failed',
      });
    }
  }

  return results;
}

/** Cron: sync connected Gmail accounts (batched per invocation). */
export async function GET(request: Request) {
  if (!authorizeCron(request)) {
    return jsonErr('UNAUTHORIZED', 'Invalid cron secret', 401);
  }

  if (isCronDisabled(CRON_KILL_SWITCH.GMAIL_SYNC)) {
    return cronSkippedResponse('gmail-sync disabled');
  }

  const results = await syncAllConnectedUsers();
  return jsonOk({ results });
}

/** Authenticated user: sync their mailbox now. */
export async function POST() {
  const auth = await requireEmailAssistantApiUser();

  if (!auth.ok) {
    return auth.response;
  }

  try {
    const result = await syncUserMailbox(auth.user.id);
    return jsonOk(result);
  } catch (error) {
    return jsonErr(
      'SYNC_FAILED',
      error instanceof Error ? error.message : 'Gmail sync failed',
      500,
    );
  }
}
