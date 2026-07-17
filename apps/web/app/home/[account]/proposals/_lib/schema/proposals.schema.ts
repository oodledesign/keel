import { z } from 'zod';

const optionalString = z.string().optional();
const optionalNullableString = z.string().nullable().optional();

const proposalStatus = z.enum([
  'draft',
  'sent',
  'read',
  'approved',
  'declined',
]);

export const ProposalContextRefSchema = z.object({
  type: z.enum(['note', 'file']),
  id: z.string().uuid(),
  title: z.string().max(500),
});

const clientOrDealRefine = <T extends z.ZodTypeAny>(schema: T) =>
  schema.superRefine((data, ctx) => {
    const row = data as { client_id?: string | null; deal_id?: string | null };
    if (!row.client_id && !row.deal_id) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Either client_id or deal_id is required',
        path: ['client_id'],
      });
    }
  });

export const ListProposalsSchema = z.object({
  accountId: z.string().uuid(),
  page: z.coerce.number().int().min(1).optional().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).optional().default(20),
  query: optionalString,
  status: z
    .enum([
      'draft',
      'sent',
      'read',
      'approved',
      'declined',
      'unapproved',
      'pending',
      'all',
    ])
    .optional(),
  clientId: z.string().uuid().optional(),
  dealId: z.string().uuid().optional(),
  dateFrom: optionalNullableString,
  dateTo: optionalNullableString,
});

export const GetProposalSchema = z.object({
  accountId: z.string().uuid(),
  proposalId: z.string().uuid(),
});

export const CreateProposalSchema = clientOrDealRefine(
  z.object({
    accountId: z.string().uuid(),
    client_id: z.string().uuid().nullable().optional(),
    deal_id: z.string().uuid().nullable().optional(),
    title: optionalNullableString,
    content_html: optionalNullableString,
    recipient_name: optionalNullableString,
    recipient_email: optionalNullableString,
    total_pence: z.number().int().min(0).nullable().optional(),
    currency: z.string().optional().default('gbp'),
    expires_at: optionalNullableString,
    private_note: optionalNullableString,
    context_refs: z.array(ProposalContextRefSchema).optional(),
  }),
);

export const UpdateProposalSchema = z.object({
  accountId: z.string().uuid(),
  proposalId: z.string().uuid(),
  client_id: z.string().uuid().nullable().optional(),
  deal_id: z.string().uuid().nullable().optional(),
  title: optionalNullableString,
  content_html: optionalNullableString,
  recipient_name: optionalNullableString,
  recipient_email: optionalNullableString,
  total_pence: z.number().int().min(0).nullable().optional(),
  currency: z.string().optional(),
  expires_at: optionalNullableString,
  private_note: optionalNullableString,
  email_subject: optionalNullableString,
  email_body: optionalNullableString,
  email_signature: optionalNullableString,
  context_refs: z.array(ProposalContextRefSchema).optional(),
});

export const DeleteProposalSchema = z.object({
  accountId: z.string().uuid(),
  proposalId: z.string().uuid(),
});

export const SendProposalSchema = z.object({
  accountId: z.string().uuid(),
  proposalId: z.string().uuid(),
  sent_to_email: z.string().email('Valid email required'),
  email_subject: optionalNullableString,
  email_body: optionalNullableString,
  email_signature: optionalNullableString,
  send_test_to_self: z.boolean().optional(),
});

export const DuplicateProposalSchema = z.object({
  accountId: z.string().uuid(),
  proposalId: z.string().uuid(),
});

export const ArchiveProposalSchema = z.object({
  accountId: z.string().uuid(),
  proposalId: z.string().uuid(),
  archived: z.boolean(),
});

export const SetProposalStatusSchema = z.object({
  accountId: z.string().uuid(),
  proposalId: z.string().uuid(),
  status: z.enum(['approved', 'declined']),
});

export const GetProposalPortalLinkSchema = z.object({
  accountId: z.string().uuid(),
  proposalId: z.string().uuid(),
});

export const GetProposalForPortalSchema = z.object({
  token: z.string().min(1, 'Token is required'),
});

export const AddProposalCommentSchema = z.object({
  accountId: z.string().uuid(),
  proposalId: z.string().uuid(),
  body: z.string().min(1, 'Comment is required'),
});

export const AddProposalCommentByTokenSchema = z.object({
  token: z.string().min(1, 'Token is required'),
  author_name: z.string().min(1, 'Name is required'),
  body: z.string().min(1, 'Comment is required'),
});

export const ApproveProposalByTokenSchema = z.object({
  token: z.string().min(1, 'Token is required'),
  recipient_name: optionalNullableString,
});

export const DeclineProposalByTokenSchema = z.object({
  token: z.string().min(1, 'Token is required'),
  reason: optionalNullableString,
});

export const ResendProposalSchema = z.object({
  accountId: z.string().uuid(),
  proposalId: z.string().uuid(),
});

export type ListProposalsInput = z.infer<typeof ListProposalsSchema>;
export type GetProposalInput = z.infer<typeof GetProposalSchema>;
export type CreateProposalInput = z.infer<typeof CreateProposalSchema>;
export type UpdateProposalInput = z.infer<typeof UpdateProposalSchema>;
export type DeleteProposalInput = z.infer<typeof DeleteProposalSchema>;
export type SendProposalInput = z.infer<typeof SendProposalSchema>;
export type DuplicateProposalInput = z.infer<typeof DuplicateProposalSchema>;
export type ArchiveProposalInput = z.infer<typeof ArchiveProposalSchema>;
export type SetProposalStatusInput = z.infer<typeof SetProposalStatusSchema>;
export type GetProposalPortalLinkInput = z.infer<
  typeof GetProposalPortalLinkSchema
>;
export type GetProposalForPortalInput = z.infer<
  typeof GetProposalForPortalSchema
>;
export type AddProposalCommentInput = z.infer<typeof AddProposalCommentSchema>;
export type AddProposalCommentByTokenInput = z.infer<
  typeof AddProposalCommentByTokenSchema
>;
export type ApproveProposalByTokenInput = z.infer<
  typeof ApproveProposalByTokenSchema
>;
export type DeclineProposalByTokenInput = z.infer<
  typeof DeclineProposalByTokenSchema
>;
export type ResendProposalInput = z.infer<typeof ResendProposalSchema>;
