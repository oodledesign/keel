import { z } from 'zod';

import { isPaymentPlanTotalValid } from '~/lib/contracts/payment-plan';

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
  percent: z.number().finite().min(0).max(100),
});

// Empty is fine (no instalments configured); if any rows are present they
// must total exactly 100% (within floating point tolerance) — see
// ~/lib/contracts/payment-plan for the shared rule used again server-side
// in ContractsService.
export const PaymentPlanSchema = z
  .array(PaymentPlanItemSchema)
  .refine(isPaymentPlanTotalValid, {
    message: 'Payment plan percentages must total exactly 100%',
  });

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
      'archived',
      'all',
    ])
    .optional(),
  clientId: z.string().uuid().optional(),
  dealId: z.string().uuid().optional(),
  includeArchived: z.boolean().optional().default(false),
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
    template_id: z.string().uuid().nullable().optional(),
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
  expiry_days: z.coerce.number().int().min(1).max(3650).optional(),
  signing_expiry_days: z.coerce.number().int().min(1).max(3650).nullable().optional(),
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
  version_id: z.string().uuid().optional(),
  content_hash: z.string().min(1).optional(),
  signer_id: z.string().uuid().optional(),
});

export const DeclineRecipientSchema = z.object({
  token: z.string().min(1, 'Token is required'),
  reason: z.string().max(2000).nullable().optional(),
});

export const SendContractReminderSchema = z.object({
  accountId: z.string().uuid(),
  contractId: z.string().uuid(),
  sent_to_email: z.string().email().optional(),
  expiry_days: z.coerce.number().int().min(1).max(3650).optional(),
  kind: z.enum(['reminder', 'resend']).optional().default('reminder'),
});

export const SetContractPortalLinkExpirySchema = z.object({
  accountId: z.string().uuid(),
  contractId: z.string().uuid(),
  expiry_days: z.coerce.number().int().min(1).max(3650).nullable(),
});

export const ArchiveContractSchema = z.object({
  accountId: z.string().uuid(),
  contractId: z.string().uuid(),
  archived: z.boolean(),
});

export const DuplicateContractSchema = z.object({
  accountId: z.string().uuid(),
  contractId: z.string().uuid(),
});

export const GetContractForPortalSchema = z.object({
  token: z.string().min(1, 'Token is required'),
});

export const GetContractPortalLinkSchema = z.object({
  accountId: z.string().uuid(),
  contractId: z.string().uuid(),
  expiry_days: z.coerce.number().int().min(1).max(3650).optional(),
});

export const RevokeContractPortalLinkSchema = z.object({
  accountId: z.string().uuid(),
  contractId: z.string().uuid(),
});

export const ListContractEventsSchema = z.object({
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
export type SendContractReminderInput = z.infer<
  typeof SendContractReminderSchema
>;
export type SetContractPortalLinkExpiryInput = z.infer<
  typeof SetContractPortalLinkExpirySchema
>;
export type DeclineRecipientInput = z.infer<typeof DeclineRecipientSchema>;
export type ArchiveContractInput = z.infer<typeof ArchiveContractSchema>;
export type DuplicateContractInput = z.infer<typeof DuplicateContractSchema>;
export type GetContractForPortalInput = z.infer<
  typeof GetContractForPortalSchema
>;
export type GetContractPortalLinkInput = z.infer<
  typeof GetContractPortalLinkSchema
>;
export type RevokeContractPortalLinkInput = z.infer<
  typeof RevokeContractPortalLinkSchema
>;
export type ListContractEventsInput = z.infer<typeof ListContractEventsSchema>;
export type SetContractStatusInput = z.infer<typeof SetContractStatusSchema>;
export type GenerateInvoicesFromPaymentPlanInput = z.infer<
  typeof GenerateInvoicesFromPaymentPlanSchema
>;
export type ListContractTemplatesInput = z.infer<
  typeof ListContractTemplatesSchema
>;
export type CreateContractTemplateInput = z.infer<
  typeof CreateContractTemplateSchema
>;
export type UpdateContractTemplateInput = z.infer<
  typeof UpdateContractTemplateSchema
>;
export type DeleteContractTemplateInput = z.infer<
  typeof DeleteContractTemplateSchema
>;
export type SaveContractAsTemplateInput = z.infer<
  typeof SaveContractAsTemplateSchema
>;
export type CreateContractVersionInput = z.infer<
  typeof CreateContractVersionSchema
>;
export type UpsertContractSignersInput = z.infer<
  typeof UpsertContractSignersSchema
>;

export const ListContractTemplatesSchema = z.object({
  accountId: z.string().uuid(),
});

export const CreateContractTemplateSchema = z.object({
  accountId: z.string().uuid(),
  name: z.string().min(1, 'Template name is required').max(200),
  content_html: z.string().optional().default(''),
  default_title: optionalNullableString,
  default_total_pence: z.number().int().min(0).optional().default(0),
  default_payment_plan: PaymentPlanSchema.optional().default([]),
});

export const UpdateContractTemplateSchema = z.object({
  accountId: z.string().uuid(),
  templateId: z.string().uuid(),
  name: z.string().min(1).max(200).optional(),
  content_html: z.string().optional(),
  default_title: optionalNullableString,
  default_total_pence: z.number().int().min(0).optional(),
  default_payment_plan: PaymentPlanSchema.optional(),
});

export const DeleteContractTemplateSchema = z.object({
  accountId: z.string().uuid(),
  templateId: z.string().uuid(),
});

export const SaveContractAsTemplateSchema = z.object({
  accountId: z.string().uuid(),
  contractId: z.string().uuid(),
  name: z.string().min(1, 'Template name is required').max(200),
});

export const CreateContractVersionSchema = z.object({
  accountId: z.string().uuid(),
  contractId: z.string().uuid(),
});

export const AdditionalContractSignerSchema = z.object({
  name: z.string().min(1, 'Signer name is required').max(200),
  email: z.string().email().nullable().optional(),
  company: optionalNullableString,
  party_type: partyType.nullable().optional(),
  signing_order: z.coerce.number().int().min(3).max(20),
});

export const UpsertContractSignersSchema = z.object({
  accountId: z.string().uuid(),
  contractId: z.string().uuid(),
  signers: z.array(AdditionalContractSignerSchema).max(8),
});
