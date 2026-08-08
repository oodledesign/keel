import { z } from 'zod';

export const PortalTicketStatusSchema = z.enum([
  'open',
  'in-progress',
  'pending_credits',
  'waiting',
  'resolved',
  'closed',
]);

export const PortalTicketPrioritySchema = z.enum([
  'low',
  'medium',
  'high',
  'urgent',
]);

export const ListPortalTicketsSchema = z.object({
  clientOrgId: z.string().uuid(),
  status: PortalTicketStatusSchema.optional(),
});

export const GetPortalTicketSchema = z.object({
  clientOrgId: z.string().uuid(),
  ticketId: z.string().uuid(),
});

export const CreatePortalTicketSchema = z.object({
  clientOrgId: z.string().uuid(),
  accountId: z.string().uuid(),
  accountSlug: z.string().min(1).optional(),
  title: z.string().min(1, 'Title is required'),
  description: z.string().min(1, 'Description is required'),
  priority: PortalTicketPrioritySchema.default('medium'),
  project_id: z.string().uuid().nullable().optional(),
  request_type_id: z.string().uuid().nullable().optional(),
  /** Portal wizard intent — validated against request_types.is_support. */
  request_intent: z.enum(['service', 'support']),
  recording_url: z.string().url().nullable().optional().or(z.literal('')),
  external_url: z.string().url().nullable().optional().or(z.literal('')),
  attachments: z
    .array(
      z.object({
        name: z.string(),
        url: z.string().url(),
        mimeType: z.string(),
        size: z.number(),
      }),
    )
    .max(5)
    .optional(),
});

export const AddPortalTicketMessageSchema = z.object({
  clientOrgId: z.string().uuid(),
  ticketId: z.string().uuid(),
  accountId: z.string().uuid().optional(),
  accountSlug: z.string().min(1).optional(),
  message: z.string().min(1, 'Message is required'),
  attachments: z
    .array(
      z.object({
        name: z.string(),
        url: z.string().url(),
        mimeType: z.string(),
        size: z.number(),
      }),
    )
    .max(5)
    .optional(),
  external_url: z.string().url().nullable().optional().or(z.literal('')),
  reopen: z.boolean().optional(),
});

export const ListPortalProjectsSchema = z.object({
  clientOrgId: z.string().uuid(),
  accountId: z.string().uuid(),
});

export const AddPortalTaskCommentSchema = z.object({
  clientOrgId: z.string().uuid(),
  taskId: z.string().uuid(),
  projectId: z.string().uuid(),
  body: z.string().min(1, 'Comment is required'),
});

export const SendPortalMessageSchema = z.object({
  clientOrgId: z.string().uuid(),
  threadId: z.string().uuid(),
  body: z.string().min(1, 'Message is required'),
});

export type PortalTicketStatus = z.infer<typeof PortalTicketStatusSchema>;
export type PortalTicketPriority = z.infer<typeof PortalTicketPrioritySchema>;
export type CreatePortalTicketInput = z.infer<typeof CreatePortalTicketSchema>;
export type AddPortalTicketMessageInput = z.infer<
  typeof AddPortalTicketMessageSchema
>;
