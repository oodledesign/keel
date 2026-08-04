import { expireStaleBatches } from '~/lib/media-credits/ledger';
import { jsonErr, jsonOk } from '~/lib/rankly/api-response';

export const runtime = 'nodejs';
export const maxDuration = 60;

function authorizeCron(request: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  return request.headers.get('authorization') === `Bearer ${secret}`;
}

/** Daily sweep for expired monthly-grant and top-up media batches. */
export async function GET(request: Request) {
  if (!authorizeCron(request)) {
    return jsonErr('UNAUTHORIZED', 'Invalid cron secret', 401);
  }

  try {
    const expired = await expireStaleBatches();
    return jsonOk({ expired });
  } catch (err) {
    return jsonErr(
      'INTERNAL_ERROR',
      err instanceof Error ? err.message : 'Expire sweep failed',
      500,
    );
  }
}
