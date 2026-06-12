import { z } from 'zod';

export const PortalTicketStatusSchema = z.enum([
  'open',
  'in-progress',
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
  title: z.string().min(1, 'Title is required'),
  description: z.string().min(1, 'Description is required'),
  priority: PortalTicketPrioritySchema.default('medium'),
});

export const AddPortalTicketMessageSchema = z.object({
  clientOrgId: z.string().uuid(),
  ticketId: z.string().uuid(),
  message: z.string().min(1, 'Message is required'),
});

export type PortalTicketStatus = z.infer<typeof PortalTicketStatusSchema>;
export type PortalTicketPriority = z.infer<typeof PortalTicketPrioritySchema>;
export type CreatePortalTicketInput = z.infer<typeof CreatePortalTicketSchema>;
export type AddPortalTicketMessageInput = z.infer<
  typeof AddPortalTicketMessageSchema
>;
