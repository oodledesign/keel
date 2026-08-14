'use server';

import { enhanceAction } from '@kit/next/actions';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

import { z } from 'zod';

import { mapKatoTransactionFiles } from '~/lib/commercial/kato-transactions-import';
import lettingsSeed from '~/lib/commercial/seed/kato-letting-transactions.json';
import salesSeed from '~/lib/commercial/seed/kato-sale-transactions.json';

import { createLeasesService } from './leases.service';

const ImportKatoTransactionsSchema = z.object({
  accountId: z.string().uuid(),
  sales: z.array(z.record(z.string(), z.unknown())).optional(),
  lettings: z.array(z.record(z.string(), z.unknown())).optional(),
});

const ImportHistoricSchema = z.object({
  accountId: z.string().uuid(),
});

export const importKatoTransactions = enhanceAction(
  async (input) => {
    const { requireCommercialBillableActor } =
      await import('~/lib/commercial/require-commercial-billable-actor');
    await requireCommercialBillableActor(
      input.accountId,
      'import sales and lettings',
    );

    const rows = mapKatoTransactionFiles({
      sales: input.sales,
      lettings: input.lettings,
    });

    const service = createLeasesService(getSupabaseServerClient());
    return service.upsertImportedTransactions(input.accountId, rows);
  },
  { schema: ImportKatoTransactionsSchema },
);

/** Idempotent import from bundled Kato JSON seeds (safe to re-run). */
export const importKatoHistoricRegister = enhanceAction(
  async (input) => {
    const { requireCommercialBillableActor } =
      await import('~/lib/commercial/require-commercial-billable-actor');
    await requireCommercialBillableActor(
      input.accountId,
      'import sales and lettings',
    );

    const rows = mapKatoTransactionFiles({
      sales: salesSeed as Record<string, unknown>[],
      lettings: lettingsSeed as Record<string, unknown>[],
    });

    const service = createLeasesService(getSupabaseServerClient());
    return service.upsertImportedTransactions(input.accountId, rows);
  },
  { schema: ImportHistoricSchema },
);
