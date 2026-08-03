import { processDueTaskRecurringSeries } from '~/home/(user)/_lib/server/task-recurring.server';
import {
  CRON_KILL_SWITCH,
  cronSkippedResponse,
  isCronDisabled,
} from '~/lib/cron/cron-guards';
import { jsonErr, jsonOk } from '~/lib/rankly/api-response';

export const runtime = 'nodejs';
export const maxDuration = 60;

function authorizeCron(request: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  return request.headers.get('authorization') === `Bearer ${secret}`;
}

/** Daily: spawn due recurring tasks from active series. */
export async function GET(request: Request) {
  if (!authorizeCron(request)) {
    return jsonErr('UNAUTHORIZED', 'Invalid cron secret', 401);
  }

  if (isCronDisabled(CRON_KILL_SWITCH.ALL)) {
    return cronSkippedResponse('all crons disabled');
  }

  try {
    const result = await processDueTaskRecurringSeries();
    return jsonOk({ created: result.created });
  } catch (error) {
    console.error('[tasks] recurring cron', error);
    return jsonErr(
      'CRON_FAILED',
      error instanceof Error ? error.message : 'Recurring task cron failed',
      500,
    );
  }
}
