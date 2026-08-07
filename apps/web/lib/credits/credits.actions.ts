'use server';

import { z } from 'zod';

import { enhanceAction } from '@kit/next/actions';

import { createCreditTopupInvoice } from '~/lib/credits/create-credit-topup-invoice';
import { ensureRetainerRecurringSeries } from '~/lib/credits/ensure-retainer-recurring-series';

const CreateCreditTopupInvoiceSchema = z.object({
  accountId: z.string().uuid(),
  clientId: z.string().uuid(),
  units: z.coerce.number().int().positive(),
  totalPence: z.coerce.number().int().min(0),
  currency: z.string().optional(),
  expiryMonths: z.coerce.number().int().positive().optional(),
  description: z.string().max(500).optional(),
  autoSend: z.boolean().optional(),
  sendToEmail: z.string().email().optional().nullable(),
});

export const createCreditTopupInvoiceAction = enhanceAction(
  async (input) => createCreditTopupInvoice(input),
  { schema: CreateCreditTopupInvoiceSchema },
);

const EnsureRetainerSeriesSchema = z.object({
  accountId: z.string().uuid(),
  subscriptionId: z.string().uuid(),
  nextIssueAt: z.string().datetime().optional(),
  frequency: z.enum(['monthly', 'yearly']).optional(),
  autoSend: z.boolean().optional(),
});

export const ensureRetainerRecurringSeriesAction = enhanceAction(
  async (input) => ensureRetainerRecurringSeries(input),
  { schema: EnsureRetainerSeriesSchema },
);
