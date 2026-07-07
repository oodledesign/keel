import 'server-only';

import { getSupabaseServerClient } from '@kit/supabase/server-client';

import { createClientsService } from '~/home/[account]/clients/_lib/server/clients.service';
import {
  getInvoiceSummary,
  getInvoiceTabCounts,
} from './invoice-v2.server';
import { createInvoicesService } from './invoices.service';

export type InvoicesPageInitialData = {
  invoices: unknown[];
  total: number;
  counts: Awaited<ReturnType<typeof getInvoiceTabCounts>>;
  summary: Awaited<ReturnType<typeof getInvoiceSummary>>;
  clients: Array<{ id: string; display_name: string | null }>;
};

export async function loadInvoicesPageInitialData(
  accountId: string,
): Promise<InvoicesPageInitialData> {
  const client = getSupabaseServerClient();
  const invoicesService = createInvoicesService(client);
  const clientsService = createClientsService(client);

  const [invoicesResult, counts, summary, clientsResult] = await Promise.all([
    invoicesService.listInvoices({
      accountId,
      page: 1,
      pageSize: 20,
      status: 'unpaid',
    }),
    getInvoiceTabCounts(accountId),
    getInvoiceSummary(accountId, 'month_to_date'),
    clientsService.listClients({ accountId, page: 1, pageSize: 100 }),
  ]);

  return {
    invoices: invoicesResult.data ?? [],
    total: invoicesResult.total ?? 0,
    counts,
    summary,
    clients: (clientsResult.data ?? []).map((row) => ({
      id: row.id,
      display_name: row.display_name ?? null,
    })),
  };
}
