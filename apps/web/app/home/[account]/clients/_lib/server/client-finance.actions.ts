'use server';

import { z } from 'zod';

import { enhanceAction } from '@kit/next/actions';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

import { accumulateFinanceTotals } from '~/lib/finance/transaction-totals';

export const loadClientFinanceAction = enhanceAction(
  async (input) => {
    const client = getSupabaseServerClient();

    const { data: clientRow, error: clientError } = await client
      .from('clients')
      .select('id, display_name, company_name, first_name, last_name')
      .eq('id', input.clientId)
      .eq('account_id', input.accountId)
      .maybeSingle();

    if (clientError) throw clientError;
    if (!clientRow) {
      throw new Error('Client not found');
    }

    const { data: projects, error: projectsError } = await client
      .from('projects')
      .select('value_pence, cost_pence')
      .eq('account_id', input.accountId)
      .eq('client_id', input.clientId)
      .eq('project_type', 'delivery');

    if (projectsError) throw projectsError;

    const { data: transactions, error: txError } = await client
      .from('finance_transactions')
      .select(
        'id, transaction_date, description, amount_pence, is_transfer, category_id, client_id, project_id',
      )
      .eq('account_id', input.accountId)
      .eq('client_id', input.clientId)
      .order('transaction_date', { ascending: false })
      .limit(200);

    if (txError) throw txError;

    const totals = accumulateFinanceTotals(
      (transactions ?? []).map((tx) => ({
        amount_pence: tx.amount_pence as number,
        is_transfer: tx.is_transfer as boolean | null | undefined,
      })),
    );

    const linkedCount = (transactions ?? []).filter((tx) => !tx.is_transfer).length;
    const transferCount = (transactions ?? []).filter((tx) => tx.is_transfer).length;

    let estimatedValuePence = 0;
    let estimatedCostPence = 0;
    for (const project of projects ?? []) {
      estimatedValuePence += (project.value_pence as number | null) ?? 0;
      estimatedCostPence += (project.cost_pence as number | null) ?? 0;
    }

    const label =
      (clientRow.display_name as string | null)?.trim() ||
      [clientRow.first_name, clientRow.last_name].filter(Boolean).join(' ').trim() ||
      (clientRow.company_name as string | null)?.trim() ||
      'Client';

    return {
      client: {
        id: clientRow.id as string,
        label,
      },
      transactions: transactions ?? [],
      summary: {
        incomePence: totals.incomePence,
        expensePence: totals.expensePence,
        netPence: totals.netPence,
        transferPence: totals.transferPence,
        linkedCount,
        transferCount,
        estimatedValuePence,
        estimatedCostPence,
        projectCount: projects?.length ?? 0,
      },
    };
  },
  {
    schema: z.object({
      accountId: z.string().uuid(),
      clientId: z.string().uuid(),
    }),
  },
);
