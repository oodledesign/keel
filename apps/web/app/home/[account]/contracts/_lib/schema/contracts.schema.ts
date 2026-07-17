import { z } from 'zod';

const optionalString = z.string().optional();
const optionalNullableString = z.string().nullable().optional();

export const contractStatus = z.enum([
  'draft',
  'ready_to_sign',
  'sent',
  'signed',
  'cancelled',
]);

export const signatureType = z.enum(['typed', 'drawn', 'uploaded']);

export const partyType = z.enum(['individual', 'company']);

export const PaymentPlanItemSchema = z.object({
  label: z.string().min(1),
  percent: z.number().min(0).max(100),
});

export const PaymentPlanSchema = z.array(PaymentPlanItemSchema);

const clientOrDealRefine = <T extends z.ZodTypeAny>(schema: T) =>
  schema.refine(
    (data: { client_id?: string | null; deal_id?: string | null }) =>
      Boolean(data.client_id) || Boolean(data.deal_id),
    { message: 'Either client_id or deal_id is required' },
  );

export const ListContractsSchema = z.object({
  accountId: z.string().uuid(),
  page: z.coerce.number().int().min(1).optional().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).optional().default(20),
  query: optionalString,
  status: z
    .enum([
      'unsigned',
      'draft',
      'ready_to_sign',
      'sent',
      'signed',
      'cancelled',
      'all',
    ])
    .optional(),
  clientId: z.string().uuid().optional(),
  dealId: z.string().uuid().optional(),
});

export const GetContractSchema = z.object({
  accountId: z.string().uuid(),
  contractId: z.string().uuid(),
});

export const CreateContractSchema = clientOrDealRefine(
  z.object({
    accountId: z.string().uuid(),
    client_id: z.string().uuid().nullable().optional(),
    deal_id: z.string().uuid().nullable().optional(),
    proposal_id: z.string().uuid().nullable().optional(),
    title: optionalNullableString,
    content_html: optionalNullableString,
    total_pence: z.number().int().min(0).optional().default(0),
    currency: z.string().optional().default('gbp'),
    payment_plan: PaymentPlanSchema.optional().default([]),
    auto_send_on_approval: z.boolean().optional().default(false),
    recipient_email: optionalNullableString,
    recipient_name: optionalNullableString,
    recipient_company: optionalNullableString,
    recipient_type: partyType.nullable().optional(),
  }),
);

export const UpdateContractSchema = z.object({
  accountId: z.string().uuid(),
  contractId: z.string().uuid(),
  client_id: z.string().uuid().nullable().optional(),
  deal_id: z.string().uuid().nullable().optional(),
  title: optionalNullableString,
  content_html: optionalNullableString,
  total_pence: z.number().int().min(0).optional(),
  currency: z.string().optional(),
  payment_plan: PaymentPlanSchema.optional(),
  auto_send_on_approval: z.boolean().optional(),
  author_type: partyType.nullable().optional(),
  author_name: optionalNullableString,
  author_company: optionalNullableString,
  recipient_type: partyType.nullable().optional(),
  recipient_name: optionalNullableString,
  recipient_company: optionalNullableString,
  recipient_email: optionalNullableString,
  email_subject: optionalNullableString,
  email_body: optionalNullableString,
  email_signature: optionalNullableString,
  private_note: optionalNullableString,
});

export const DeleteContractSchema = z.object({
  accountId: z.string().uuid(),
  contractId: z.string().uuid(),
});

export const SendContractSchema = z.object({
  accountId: z.string().uuid(),
  contractId: z.string().uuid(),
  sent_to_email: z.string().email('Valid email required'),
  email_subject: optionalNullableString,
  email_body: optionalNullableString,
  email_signature: optionalNullableString,
  send_test_to_self: z.boolean().optional(),
});

export const SignAuthorSchema = z.object({
  accountId: z.string().uuid(),
  contractId: z.string().uuid(),
  author_type: partyType,
  author_name: z.string().min(1, 'Author name is required'),
  author_company: optionalNullableString,
  author_signature_type: signatureType,
  author_signature_data: z.string().min(1, 'Signature is required'),
  send_after_sign: z.boolean().optional().default(false),
  sent_to_email: z.string().email().optional(),
});

export const SignRecipientSchema = z.object({
  token: z.string().min(1, 'Token is required'),
  recipient_type: partyType,
  recipient_name: z.string().min(1, 'Recipient name is required'),
  recipient_company: optionalNullableString,
  recipient_signature_type: signatureType,
  recipient_signature_data: z.string().min(1, 'Signature is required'),
});

export const GetContractForPortalSchema = z.object({
  token: z.string().min(1, 'Token is required'),
});

export const GetContractPortalLinkSchema = z.object({
  accountId: z.string().uuid(),
  contractId: z.string().uuid(),
});

export const SetContractStatusSchema = z.object({
  accountId: z.string().uuid(),
  contractId: z.string().uuid(),
  status: z.enum(['cancelled']),
});

export const GenerateInvoicesFromPaymentPlanSchema = z.object({
  accountId: z.string().uuid(),
  contractId: z.string().uuid(),
});

export type ContractStatus = z.infer<typeof contractStatus>;
export type SignatureType = z.infer<typeof signatureType>;
export type PaymentPlanItem = z.infer<typeof PaymentPlanItemSchema>;
export type ListContractsInput = z.infer<typeof ListContractsSchema>;
export type GetContractInput = z.infer<typeof GetContractSchema>;
export type CreateContractInput = z.infer<typeof CreateContractSchema>;
export type UpdateContractInput = z.infer<typeof UpdateContractSchema>;
export type DeleteContractInput = z.infer<typeof DeleteContractSchema>;
export type SendContractInput = z.infer<typeof SendContractSchema>;
export type SignAuthorInput = z.infer<typeof SignAuthorSchema>;
export type SignRecipientInput = z.infer<typeof SignRecipientSchema>;
export type GetContractForPortalInput = z.infer<
  typeof GetContractForPortalSchema
>;
export type GetContractPortalLinkInput = z.infer<
  typeof GetContractPortalLinkSchema
>;
export type SetContractStatusInput = z.infer<typeof SetContractStatusSchema>;
export type GenerateInvoicesFromPaymentPlanInput = z.infer<
  typeof GenerateInvoicesFromPaymentPlanSchema
>;
