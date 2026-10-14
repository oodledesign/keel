import { timingSafeEqual } from 'crypto';

import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

import { advanceRun } from '~/lib/instagram-autoreply/sequence/run-engine';
import { jsonErr, jsonOk } from '~/lib/rankly/api-response';

export const runtime = 'nodejs';
export const maxDuration = 300;

const BATCH_SIZE = 25;
const CONCURRENCY = 5;
/** Stop claiming new work with enough headroom to finish in-flight runs. */
const TIME_BUDGET_MS = 240_000;

function authorizeCron(request: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  const incoming = request.headers.get('authorization') ?? '';
  const expected = `Bearer ${secret}`;
  const a = Buffer.from(incoming);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Advance Instagram automation runs that are due: delays that have elapsed,
 * retries after a transient Meta error, and sends deferred by the hourly cap.
 */
export async function GET(request: Request) {
  if (!authorizeCron(request)) {
    return jsonErr('UNAUTHORIZED', 'Invalid cron secret', 401);
  }

  const admin = getSupabaseServerAdminClient();
  const startedAt = Date.now();
  let processed = 0;

  while (Date.now() - startedAt < TIME_BUDGET_MS) {
    const { data, error } = await admin.rpc('claim_ig_automation_runs', {
      p_limit: BATCH_SIZE,
    });
    if (error) return jsonErr('CLAIM_FAILED', error.message, 500);

    const runIds = ((data ?? []) as Array<string | { id: string }>).map(
      (row) => (typeof row === 'string' ? row : row.id),
    );
    if (runIds.length === 0) break;

    for (let i = 0; i < runIds.length; i += CONCURRENCY) {
      await Promise.all(
        runIds
          .slice(i, i + CONCURRENCY)
          .map((runId) => advanceRun(admin, runId, { lockHeld: true })),
      );
    }
    processed += runIds.length;

    if (runIds.length < BATCH_SIZE) break;
  }

  return jsonOk({ processed });
}
