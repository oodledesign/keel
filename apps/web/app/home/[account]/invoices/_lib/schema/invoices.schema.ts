import { z } from 'zod';

const optionalString = z.string().optional();
const optionalNullableString = z.string().nullable().optional();

export const ListInvoicesSchema = z.object({
  accountId: z.string().uuid(),
  page: z.coerce.number().int().min(1).optional().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).optional().default(20),
  query: optionalString,
  status: z.enum(['draft', 'sent', 'paid', 'overdue', 'cancelled']).optional(),
});

export const GetInvoiceSchema = z.object({
  accountId: z.string().uuid(),
  invoiceId: z.string().uuid(),
});

export const CreateInvoiceSchema = z.object({
  accountId: z.string().uuid(),
  client_id: z.string().uuid(),
  job_id: optionalNullableString,
  due_at: optionalNullableString,
  notes: optionalNullableString,
});

export const UpdateInvoiceSchema = z.object({
  accountId: z.string().uuid(),
  invoiceId: z.string().uuid(),
  client_id: z.string().uuid().optional(),
  due_at: optionalNullableString,
  notes: optionalNullableString,
});

export const DeleteInvoiceSchema = z.object({
  accountId: z.string().uuid(),
  invoiceId: z.string().uuid(),
});

export const InvoiceItemSchema = z.object({
  id: z.string().uuid().optional(),
  job_id: optionalNullableString,
  sort_order: z.number().int().min(0),
  description: z.string().min(1, 'Description is required'),
  quantity: z.number().int().min(0),
  unit_price_pence: z.number().int().min(0),
  total_pence: z.number().int().min(0),
});

export const UpsertInvoiceItemsSchema = z.object({
  accountId: z.string().uuid(),
  invoiceId: z.string().uuid(),
  items: z.array(InvoiceItemSchema),
});

export const SetInvoiceStatusSchema = z.object({
  accountId: z.string().uuid(),
  invoiceId: z.string().uuid(),
  status: z.enum(['draft', 'sent', 'paid', 'overdue', 'cancelled']),
  payment_method: z.enum(['stripe', 'cash', 'bank_transfer']).optional(),
});

export const GetInvoicePortalLinkSchema = z.object({
  accountId: z.string().uuid(),
  invoiceId: z.string().uuid(),
});

export const GetInvoiceForPortalSchema = z.object({
  token: z.string().min(1, 'Token is required'),
});

export const SendInvoiceSchema = z.object({
  accountId: z.string().uuid(),
  invoiceId: z.string().uuid(),
  sent_to_email: z.string().email('Valid email required'),
});

export const CreateInvoiceCheckoutSessionByTokenSchema = z.object({
  token: z.string().min(1, 'Token is required'),
});

export type ListInvoicesInput = z.infer<typeof ListInvoicesSchema>;
export type GetInvoiceInput = z.infer<typeof GetInvoiceSchema>;
export type CreateInvoiceInput = z.infer<typeof CreateInvoiceSchema>;
export type UpdateInvoiceInput = z.infer<typeof UpdateInvoiceSchema>;
export type DeleteInvoiceInput = z.infer<typeof DeleteInvoiceSchema>;
export type InvoiceItemInput = z.infer<typeof InvoiceItemSchema>;
export type UpsertInvoiceItemsInput = z.infer<typeof UpsertInvoiceItemsSchema>;
export type SetInvoiceStatusInput = z.infer<typeof SetInvoiceStatusSchema>;
export type GetInvoiceForPortalInput = z.infer<typeof GetInvoiceForPortalSchema>;
export type SendInvoiceInput = z.infer<typeof SendInvoiceSchema>;
export type CreateInvoiceCheckoutSessionByTokenInput = z.infer<
  typeof CreateInvoiceCheckoutSessionByTokenSchema
>;
export type GetInvoicePortalLinkInput = z.infer<typeof GetInvoicePortalLinkSchema>;
