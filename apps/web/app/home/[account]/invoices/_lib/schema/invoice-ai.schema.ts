import { z } from 'zod';

import { InvoiceCurrencySchema } from '../invoice-currency';

export const GenerateInvoiceLineItemsSchema = z.object({
  accountId: z.string().uuid(),
  invoiceId: z.string().uuid(),
  prompt: z
    .string()
    .trim()
    .min(8, 'Add a bit more detail about the work and costings')
    .max(12_000),
  currency: InvoiceCurrencySchema.optional(),
});

export type GenerateInvoiceLineItemsInput = z.infer<
  typeof GenerateInvoiceLineItemsSchema
>;
