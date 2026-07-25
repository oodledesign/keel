import { z } from 'zod';

export const TicketStatusSchema = z.enum([
  'open',
  'in-progress',
  'waiting',
  'resolved',
  'closed',
]);

export const TicketPrioritySchema = z.enum(['low', 'medium', 'high', 'urgent']);

export const TicketAttachmentSchema = z.object({
  name: z.string(),
  url: z.string().url(),
  mimeType: z.string(),
  size: z.number(),
});

export const ListTicketsSchema = z.object({
  accountId: z.string().uuid(),
  status: TicketStatusSchema.optional(),
  priority: TicketPrioritySchema.optional(),
  projectId: z.string().uuid().optional(),
  q: z.string().optional(),
});

export const GetTicketSchema = z.object({
  accountId: z.string().uuid(),
  ticketId: z.string().uuid(),
});

export const CreateTicketSchema = z.object({
  accountId: z.string().uuid(),
  accountSlug: z.string().min(1).optional(),
  title: z.string().min(1, 'Title is required'),
  description: z.string().min(1, 'Description is required'),
  client_org_id: z.string().uuid().nullable().optional(),
  website_id: z.string().uuid().nullable().optional(),
  project_id: z.string().uuid().nullable().optional(),
  recording_url: z.string().url().nullable().optional().or(z.literal('')),
  external_url: z.string().url().nullable().optional().or(z.literal('')),
  priority: TicketPrioritySchema.default('medium'),
  assigned_to: z.string().uuid().nullable().optional(),
  attachments: z.array(TicketAttachmentSchema).max(5).optional(),
});

export const UpdateTicketSchema = z.object({
  accountId: z.string().uuid(),
  ticketId: z.string().uuid(),
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  status: TicketStatusSchema.optional(),
  priority: TicketPrioritySchema.optional(),
  assigned_to: z.string().uuid().nullable().optional(),
  client_org_id: z.string().uuid().nullable().optional(),
  website_id: z.string().uuid().nullable().optional(),
  project_id: z.string().uuid().nullable().optional(),
});

export const AddTicketMessageSchema = z.object({
  accountId: z.string().uuid(),
  accountSlug: z.string().min(1).optional(),
  ticketId: z.string().uuid(),
  message: z.string().min(1, 'Message is required'),
  is_internal: z.boolean().default(false),
  attachments: z.array(TicketAttachmentSchema).max(5).optional(),
  external_url: z.string().url().nullable().optional().or(z.literal('')),
});

export const ListWebsitesForOrgSchema = z.object({
  accountId: z.string().uuid(),
  clientOrgId: z.string().uuid().nullable().optional(),
});

export const ListProjectsForOrgSchema = z.object({
  accountId: z.string().uuid(),
  clientOrgId: z.string().uuid().nullable().optional(),
});

export type TicketStatus = z.infer<typeof TicketStatusSchema>;
export type TicketPriority = z.infer<typeof TicketPrioritySchema>;
export type ListTicketsInput = z.infer<typeof ListTicketsSchema>;
export type GetTicketInput = z.infer<typeof GetTicketSchema>;
export type CreateTicketInput = z.infer<typeof CreateTicketSchema>;
export type UpdateTicketInput = z.infer<typeof UpdateTicketSchema>;
export type AddTicketMessageInput = z.infer<typeof AddTicketMessageSchema>;
