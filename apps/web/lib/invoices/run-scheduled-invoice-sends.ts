import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

import { createInvoicesService } from '../../app/home/[account]/invoices/_lib/server/invoices.service';
import type { Database } from '../database.types';

export async function processDueScheduledInvoiceSends() {
  const admin = getSupabaseServerAdminClient();
  const service = createInvoicesService(
    admin as unknown as SupabaseClient<Database>,
  );

  const { data: claimed, error } = await admin.rpc(
    'claim_due_scheduled_invoice_sends',
    { p_limit: 50 },
  );
  if (error) throw new Error(error.message);

  let sent = 0;
  let failed = 0;

  for (const invoice of claimed ?? []) {
    const accountId = invoice.account_id as string;
    const invoiceId = invoice.id as string;
    const recipients = Array.isArray(invoice.scheduled_send_to_emails)
      ? (invoice.scheduled_send_to_emails as string[])
      : invoice.sent_to_email
        ? [invoice.sent_to_email as string]
        : [];

    try {
      if (recipients.length === 0) {
        throw new Error('Missing scheduled recipients');
      }

      await service.sendInvoiceAsSystem({
        accountId,
        invoiceId,
        sent_to_email: recipients[0],
        sent_to_emails: recipients,
        email_subject: invoice.email_subject as string | null | undefined,
        email_body: invoice.email_body as string | null | undefined,
        email_signature: invoice.email_signature as string | null | undefined,
      });
      sent += 1;
    } catch (err) {
      failed += 1;
      console.error('[invoices] scheduled send failed', {
        invoiceId,
        error: err instanceof Error ? err.message : err,
      });
      await admin
        .from('invoices')
        .update({ scheduled_send_processing_at: null })
        .eq('id', invoiceId);
      await admin.from('invoice_events').insert({
        account_id: accountId,
        invoice_id: invoiceId,
        event_type: 'send_schedule_failed',
        payload: {
          error: err instanceof Error ? err.message : 'Unknown error',
        },
        actor_id: null,
      });
    }
  }

  return { sent, failed, claimed: (claimed ?? []).length };
}
