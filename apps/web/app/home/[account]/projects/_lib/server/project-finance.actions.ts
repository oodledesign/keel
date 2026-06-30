'use server';

import { z } from 'zod';

import { enhanceAction } from '@kit/next/actions';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

import { accumulateFinanceTotals } from '~/lib/finance/transaction-totals';
import { projectDisplayName } from '~/lib/finance/transaction-links';

export const loadProjectFinanceAction = enhanceAction(
  async (input) => {
    const client = getSupabaseServerClient();

    const { data: project, error: projectError } = await client
      .from('projects')
      .select('id, title, name, value_pence, cost_pence, client_id')
      .eq('id', input.projectId)
      .eq('account_id', input.accountId)
      .maybeSingle();

    if (projectError) throw projectError;
    if (!project) {
      throw new Error('Project not found');
    }

    const { data: transactions, error: txError } = await client
      .from('finance_transactions')
      .select(
        'id, transaction_date, description, amount_pence, is_transfer, category_id, client_id, project_id',
      )
      .eq('account_id', input.accountId)
      .eq('project_id', input.projectId)
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

    return {
      project: {
        id: project.id as string,
        label: projectDisplayName(project as { title?: string | null; name?: string | null }),
        valuePence: (project.value_pence as number | null) ?? null,
        costPence: (project.cost_pence as number | null) ?? null,
      },
      transactions: transactions ?? [],
      summary: {
        incomePence: totals.incomePence,
        expensePence: totals.expensePence,
        netPence: totals.netPence,
        transferPence: totals.transferPence,
        linkedCount,
        transferCount,
      },
    };
  },
  {
    schema: z.object({
      accountId: z.string().uuid(),
      projectId: z.string().uuid(),
    }),
  },
);
