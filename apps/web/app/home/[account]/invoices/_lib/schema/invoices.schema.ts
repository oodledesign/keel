import { z } from 'zod';

import { InvoiceCurrencySchema } from '../invoice-currency';

const optionalString = z.string().optional();
const optionalNullableString = z.string().nullable().optional();

const discountType = z.enum(['percent', 'fixed']).nullable().optional();
const invoiceStatus = z.enum([
  'draft',
  'sent',
  'read',
  'paid',
  'overdue',
  'cancelled',
  'void',
]);

export const ListInvoicesSchema = z.object({
  accountId: z.string().uuid(),
  page: z.coerce.number().int().min(1).optional().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).optional().default(20),
  query: optionalString,
  status: z
    .enum([
      'draft',
      'sent',
      'read',
      'paid',
      'overdue',
      'cancelled',
      'void',
      'unpaid',
      'all',
    ])
    .optional(),
  clientId: z.string().uuid().optional(),
  dateFrom: optionalNullableString,
  dateTo: optionalNullableString,
  includeArchived: z.coerce.boolean().optional().default(false),
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
  title: optionalNullableString,
  reference_number: optionalNullableString,
  currency: InvoiceCurrencySchema.optional(),
});

export const UpdateInvoiceSchema = z.object({
  accountId: z.string().uuid(),
  invoiceId: z.string().uuid(),
  client_id: z.string().uuid().optional(),
  due_at: optionalNullableString,
  notes: optionalNullableString,
  title: optionalNullableString,
  reference_number: optionalNullableString,
  currency: InvoiceCurrencySchema.optional(),
  footer_message: optionalNullableString,
  private_note: optionalNullableString,
  discount_type: discountType,
  discount_value: z.number().int().min(0).nullable().optional(),
  tax_rate_bp: z.number().int().min(0).max(10000).nullable().optional(),
  deposit_type: discountType,
  deposit_value: z.number().int().min(0).nullable().optional(),
  late_fee_type: discountType,
  late_fee_value: z.number().int().min(0).nullable().optional(),
  email_subject: optionalNullableString,
  email_body: optionalNullableString,
  email_signature: optionalNullableString,
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
  description_detail: optionalNullableString,
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
  status: invoiceStatus,
  payment_method: z.enum(['stripe', 'cash', 'bank_transfer']).optional(),
});

export const GetInvoicePortalLinkSchema = z.object({
  accountId: z.string().uuid(),
  invoiceId: z.string().uuid(),
});

export const GetInvoiceForPortalSchema = z.object({
  token: z.string().min(1, 'Token is required'),
});

export const SendInvoiceSchema = z
  .object({
    accountId: z.string().uuid(),
    invoiceId: z.string().uuid(),
    sent_to_email: z.string().email('Valid email required').optional(),
    sent_to_emails: z.array(z.string().email()).optional(),
    email_subject: optionalNullableString,
    email_body: optionalNullableString,
    email_signature: optionalNullableString,
    send_test_to_self: z.boolean().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.send_test_to_self) return;
    const emails = [
      ...(data.sent_to_emails ?? []),
      ...(data.sent_to_email ? [data.sent_to_email] : []),
    ];
    if (emails.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'At least one recipient email is required',
        path: ['sent_to_emails'],
      });
    }
  });

export const MarkInvoiceSentManuallySchema = z.object({
  accountId: z.string().uuid(),
  invoiceId: z.string().uuid(),
  sent_to_email: optionalNullableString,
});

export const CreateInvoiceCheckoutSessionByTokenSchema = z.object({
  token: z.string().min(1, 'Token is required'),
  pay_deposit_only: z.boolean().optional(),
});

export const DuplicateInvoiceSchema = z.object({
  accountId: z.string().uuid(),
  invoiceId: z.string().uuid(),
});

export const ArchiveInvoiceSchema = z.object({
  accountId: z.string().uuid(),
  invoiceId: z.string().uuid(),
  archived: z.boolean(),
});

export const ResendInvoiceSchema = z.object({
  accountId: z.string().uuid(),
  invoiceId: z.string().uuid(),
});

export const GetInvoiceSummarySchema = z.object({
  accountId: z.string().uuid(),
  period: z.enum(['month_to_date', 'last_30_days', 'last_90_days']).optional(),
});

export const ListRecurringSeriesSchema = z.object({
  accountId: z.string().uuid(),
});

export const UpsertRecurringSeriesSchema = z.object({
  accountId: z.string().uuid(),
  seriesId: z.string().uuid().optional(),
  client_id: z.string().uuid(),
  title: z.string().min(1),
  currency: InvoiceCurrencySchema.default('gbp'),
  frequency: z.enum([
    'weekly',
    'fortnightly',
    'monthly',
    'quarterly',
    'yearly',
  ]),
  next_issue_at: z.string(),
  end_at: optionalNullableString,
  max_occurrences: z.number().int().min(1).nullable().optional(),
  auto_send: z.boolean().default(true),
  template: z.record(z.unknown()),
});

export const UpdateRecurringSeriesStatusSchema = z.object({
  accountId: z.string().uuid(),
  seriesId: z.string().uuid(),
  status: z.enum(['active', 'paused', 'ended']),
});

export const SavePaymentSettingsSchema = z.object({
  accountId: z.string().uuid(),
  bank_account_name: optionalNullableString,
  bank_sort_code: optionalNullableString,
  bank_account_number: optionalNullableString,
  bank_iban: optionalNullableString,
  bank_bic: optionalNullableString,
  bank_transfer_enabled: z.boolean().optional(),
  bank_transfer_instructions: optionalNullableString,
  stripe_pay_now_enabled: z.boolean().optional(),
  invoice_starting_number: z.number().int().min(1).max(999999).optional(),
  default_invoice_currency: InvoiceCurrencySchema.optional(),
});

export type ListInvoicesInput = z.infer<typeof ListInvoicesSchema>;
export type GetInvoiceInput = z.infer<typeof GetInvoiceSchema>;
export type CreateInvoiceInput = z.infer<typeof CreateInvoiceSchema>;
export type UpdateInvoiceInput = z.infer<typeof UpdateInvoiceSchema>;
export type DeleteInvoiceInput = z.infer<typeof DeleteInvoiceSchema>;
export type InvoiceItemInput = z.infer<typeof InvoiceItemSchema>;
export type UpsertInvoiceItemsInput = z.infer<typeof UpsertInvoiceItemsSchema>;
export type SetInvoiceStatusInput = z.infer<typeof SetInvoiceStatusSchema>;
export type GetInvoiceForPortalInput = z.infer<
  typeof GetInvoiceForPortalSchema
>;
export type SendInvoiceInput = z.infer<typeof SendInvoiceSchema>;
export type MarkInvoiceSentManuallyInput = z.infer<
  typeof MarkInvoiceSentManuallySchema
>;
export type CreateInvoiceCheckoutSessionByTokenInput = z.infer<
  typeof CreateInvoiceCheckoutSessionByTokenSchema
>;
export type GetInvoicePortalLinkInput = z.infer<
  typeof GetInvoicePortalLinkSchema
>;
