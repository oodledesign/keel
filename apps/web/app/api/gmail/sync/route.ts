import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

import { syncMailbox } from '@kit/gmail';
import { jsonErr, jsonOk } from '~/lib/rankly/api-response';
import { authorizeCron } from '~/lib/email-assistant/cron-auth';
import { runEmailAssistantPipeline } from '~/lib/email-assistant/post-sync-pipeline';
import { requireEmailAssistantApiUser } from '~/lib/email-assistant/require-email-assistant-api-user';

export const runtime = 'nodejs';
export const maxDuration = 300;
export const dynamic = 'force-dynamic';

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

  if (syncResult.backfillComplete === false) {
    return { ...syncResult, assistant: null };
  }

  const assistant = await runEmailAssistantPipeline(userId);
  return { ...syncResult, assistant };
}

async function syncAllConnectedUsers() {
  const admin = getSupabaseServerAdminClient();
  const { data, error } = await admin
    .from('google_connections')
    .select('user_id');

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
        error:
          syncError instanceof Error ? syncError.message : 'Sync failed',
      });
    }
  }

  return results;
}

/** Cron: sync all connected Gmail accounts. */
export async function GET(request: Request) {
  if (!authorizeCron(request)) {
    return jsonErr('UNAUTHORIZED', 'Invalid cron secret', 401);
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
