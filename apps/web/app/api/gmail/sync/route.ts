import { syncMailbox } from '@kit/gmail';
import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

import {
  CRON_KILL_SWITCH,
  cronSkippedResponse,
  isCronDisabled,
} from '~/lib/cron/cron-guards';
import { authorizeCron } from '~/lib/email-assistant/cron-auth';
import {
  type MailboxKind,
  parseMailboxKind,
} from '~/lib/email-assistant/mailbox-kind';
import { runEmailAssistantPipeline } from '~/lib/email-assistant/post-sync-pipeline';
import { requireEmailAssistantApiUser } from '~/lib/email-assistant/require-email-assistant-api-user';
import { jsonErr, jsonOk } from '~/lib/rankly/api-response';

export const runtime = 'nodejs';
export const maxDuration = 120;
export const dynamic = 'force-dynamic';

const DEFAULT_GMAIL_SYNC_BATCH_SIZE = 8;

type SyncResultRow = {
  userId: string;
  connectionId?: string;
  mailboxKind?: MailboxKind;
  ok: boolean;
  mode?: string;
  messagesProcessed?: number;
  assistant?: Awaited<ReturnType<typeof runEmailAssistantPipeline>> | null;
  error?: string;
};

async function assertGoogleConnection(
  userId: string,
  mailboxKind: MailboxKind,
) {
  const admin = getSupabaseServerAdminClient();
  const { data, error } = await admin
    .from('google_connections')
    .select('id')
    .eq('user_id', userId)
    .eq('mailbox_kind', mailboxKind)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    throw new Error('Connect Gmail in Email settings before syncing');
  }
}

async function syncUserMailbox(
  userId: string,
  mailboxKind: MailboxKind,
  options?: { assistant?: boolean; preferredAccountId?: string | null },
) {
  const syncResult = await syncMailbox(userId, mailboxKind);
  const runAssistant = options?.assistant !== false;

  if (!runAssistant) {
    return { ...syncResult, assistant: null };
  }

  let assistant: Awaited<ReturnType<typeof runEmailAssistantPipeline>> | null =
    null;

  try {
    assistant = await runEmailAssistantPipeline(userId, {
      mailboxKind,
      preferredAccountId: options?.preferredAccountId,
    });
  } catch (pipelineError) {
    assistant = {
      classified: 0,
      linked: 0,
      draftsCreated: 0,
      draftsSavedToGmail: 0,
      skipped: 0,
      errors: [
        pipelineError instanceof Error
          ? pipelineError.message
          : 'Assistant pipeline failed',
      ],
    };
  }

  return { ...syncResult, assistant };
}

async function syncAllConnectedUsers() {
  const admin = getSupabaseServerAdminClient();
  const batchSize = Math.max(
    1,
    Number(process.env.GMAIL_SYNC_BATCH_SIZE ?? DEFAULT_GMAIL_SYNC_BATCH_SIZE),
  );
  const claimBatch = admin.rpc as unknown as (
    name: 'claim_gmail_sync_batch',
    args: { p_batch_size: number },
  ) => Promise<{
    data: Array<{
      connection_id: string;
      user_id: string;
      mailbox_kind: string;
    }> | null;
    error: { message: string } | null;
  }>;
  const { data, error } = await claimBatch('claim_gmail_sync_batch', {
    p_batch_size: batchSize,
  });

  if (error) {
    throw new Error(error.message);
  }

  const results: SyncResultRow[] = [];

  for (const row of data ?? []) {
    const userId = row.user_id;
    const connectionId = row.connection_id;
    const mailboxKind = parseMailboxKind(row.mailbox_kind);

    try {
      const syncResult = await syncMailbox(userId, mailboxKind);
      let assistant: Awaited<
        ReturnType<typeof runEmailAssistantPipeline>
      > | null = null;

      if (syncResult.messagesProcessed > 0) {
        try {
          assistant = await runEmailAssistantPipeline(userId, { mailboxKind });
        } catch (pipelineError) {
          assistant = {
            classified: 0,
            linked: 0,
            draftsCreated: 0,
            draftsSavedToGmail: 0,
            skipped: 0,
            errors: [
              pipelineError instanceof Error
                ? pipelineError.message
                : 'Assistant pipeline failed',
            ],
          };
        }
      }

      results.push({
        userId,
        connectionId,
        mailboxKind,
        ok: true,
        mode: syncResult.mode,
        messagesProcessed: syncResult.messagesProcessed,
        assistant: assistant ?? undefined,
      });
    } catch (syncError) {
      results.push({
        userId,
        connectionId,
        mailboxKind,
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

  try {
    const results = await syncAllConnectedUsers();
    return jsonOk({ results });
  } catch (error) {
    return jsonErr(
      'SYNC_FAILED',
      error instanceof Error ? error.message : 'Gmail sync failed',
      500,
    );
  }
}

/** Authenticated user: sync their mailbox now. */
export async function POST(request: Request) {
  const auth = await requireEmailAssistantApiUser();

  if (!auth.ok) {
    return auth.response;
  }

  const url = new URL(request.url);
  const mode = url.searchParams.get('mode');
  const assistant = mode !== 'mail';
  const mailboxKind = parseMailboxKind(url.searchParams.get('mailbox'));
  const preferredAccountId = url.searchParams.get('preferredAccountId');

  try {
    await assertGoogleConnection(auth.user.id, mailboxKind);
    const result = await syncUserMailbox(auth.user.id, mailboxKind, {
      assistant,
      preferredAccountId,
    });
    return jsonOk(result);
  } catch (error) {
    return jsonErr(
      'SYNC_FAILED',
      error instanceof Error ? error.message : 'Gmail sync failed',
      500,
    );
  }
}
