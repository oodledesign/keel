import { jsonErr, jsonOk } from '~/lib/rankly/api-response';
import { sweepMeetingPostSync } from '~/lib/recorder/meeting-post-sync';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

function authorizeCron(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  return request.headers.get('authorization') === `Bearer ${secret}`;
}

/** Re-kick Assistant meetings whose summary or task extraction never finished. */
export async function GET(request: Request) {
  if (!authorizeCron(request)) {
    return jsonErr('UNAUTHORIZED', 'Invalid cron secret', 401);
  }

  try {
    const result = await sweepMeetingPostSync();
    return jsonOk(result);
  } catch (error) {
    console.error('[cron/meeting-post-sync]', error);
    return jsonErr(
      'MEETING_POST_SYNC_FAILED',
      error instanceof Error ? error.message : 'Meeting post-sync sweep failed',
      500,
    );
  }
}
