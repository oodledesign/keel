import { authorizeCron } from '~/lib/email-assistant/cron-auth';
import { refreshDueInstagramTokens } from '~/lib/feedflow/token-refresh';
import { jsonErr, jsonOk } from '~/lib/rankly/api-response';

export const runtime = 'nodejs';
export const maxDuration = 120;

/** Refresh Feedflow Instagram long-lived user tokens around day 50. */
export async function GET(request: Request) {
  if (!authorizeCron(request)) {
    return jsonErr('UNAUTHORIZED', 'Invalid cron secret', 401);
  }

  try {
    const result = await refreshDueInstagramTokens();
    return jsonOk(result);
  } catch (error) {
    console.error('[feedflow] token refresh cron', error);
    return jsonErr(
      'CRON_FAILED',
      error instanceof Error ? error.message : 'Feedflow token refresh failed',
      500,
    );
  }
}
