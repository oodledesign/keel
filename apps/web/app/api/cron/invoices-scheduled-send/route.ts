import { processDueScheduledInvoiceSends } from '~/lib/invoices/run-scheduled-invoice-sends';
import { jsonErr, jsonOk } from '~/lib/rankly/api-response';

export const runtime = 'nodejs';
export const maxDuration = 60;

function authorizeCron(request: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  const auth = request.headers.get('authorization');
  return auth === `Bearer ${secret}`;
}

export async function GET(request: Request) {
  if (!authorizeCron(request)) {
    return jsonErr('UNAUTHORIZED', 'Invalid cron secret', 401);
  }

  try {
    const result = await processDueScheduledInvoiceSends();
    return jsonOk(result);
  } catch (error) {
    console.error('[invoices] scheduled send cron', error);
    return jsonErr(
      'CRON_FAILED',
      error instanceof Error
        ? error.message
        : 'Scheduled invoice send cron failed',
      500,
    );
  }
}
