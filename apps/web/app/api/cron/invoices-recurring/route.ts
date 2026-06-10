import { NextResponse } from 'next/server';

import { processDueRecurringSeries } from '~/home/[account]/invoices/_lib/server/invoice-v2.server';
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
    const result = await processDueRecurringSeries();
    return jsonOk({ created: result.created });
  } catch (error) {
    console.error('[invoices] recurring cron', error);
    return jsonErr(
      'CRON_FAILED',
      error instanceof Error ? error.message : 'Recurring invoice cron failed',
      500,
    );
  }
}
