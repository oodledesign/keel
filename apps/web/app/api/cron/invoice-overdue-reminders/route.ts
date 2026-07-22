import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

import { runInvoiceOverdueReminders } from '~/lib/invoices/run-invoice-overdue-reminders';
import { jsonErr, jsonOk } from '~/lib/rankly/api-response';

export const runtime = 'nodejs';
export const maxDuration = 60;

function authorizeCron(request: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  return request.headers.get('authorization') === `Bearer ${secret}`;
}

/** Daily: notify workspace members when an invoice is past due. */
export async function GET(request: Request) {
  if (!authorizeCron(request)) {
    return jsonErr('UNAUTHORIZED', 'Invalid cron secret', 401);
  }

  const admin = getSupabaseServerAdminClient();
  const result = await runInvoiceOverdueReminders(admin);

  return jsonOk(result);
}
