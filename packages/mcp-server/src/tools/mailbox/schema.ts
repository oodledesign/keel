import { z } from 'zod/v3';

export const KitEmailsListInputSchema = z.object({
  start: z.number().int().min(0).default(0),
  limit: z.number().int().min(1).max(200).default(50),
});

const MailServerStatusSchema = z.object({
  running: z.boolean(),
  running_via_docker: z.boolean(),
  api_base_url: z.string(),
});

const EmailSummarySchema = z.object({
  id: z.string(),
  message_id: z.string().nullable(),
  subject: z.string().nullable(),
  from: z.array(z.string()),
  to: z.array(z.string()),
  created_at: z.string().nullable(),
  size: z.number().nullable(),
  read: z.boolean(),
  readAt: z.string().optional(),
});

export const KitEmailsListOutputSchema = z.object({
  mail_server: MailServerStatusSchema,
  start: z.number(),
  limit: z.number(),
  count: z.number(),
  total: z.number(),
  unread: z.number().nullable(),
  messages: z.array(EmailSummarySchema),
});

export const KitEmailsReadInputSchema = z.object({
  id: z.string().min(1),
});

export const KitEmailsReadOutputSchema = z.object({
  mail_server: MailServerStatusSchema,
  id: z.string(),
  message_id: z.string().nullable(),
  subject: z.string().nullable(),
  from: z.array(z.string()),
  to: z.array(z.string()),
  cc: z.array(z.string()),
  bcc: z.array(z.string()),
  created_at: z.string().nullable(),
  size: z.number().nullable(),
  read: z.boolean(),
  readAt: z.string().optional(),
  text: z.string().nullable(),
  html: z.string().nullable(),
  headers: z.record(z.array(z.string())),
  raw: z.unknown(),
});

export const KitEmailsSetReadStatusInputSchema = z.object({
  id: z.string().min(1),
  read: z.boolean(),
});

export const KitEmailsSetReadStatusOutputSchema = z.object({
  id: z.string(),
  read: z.boolean(),
  readAt: z.string().optional(),
});

export type KitEmailsListInput = z.infer<typeof KitEmailsListInputSchema>;
export type KitEmailsListOutput = z.infer<typeof KitEmailsListOutputSchema>;
export type KitEmailsReadInput = z.infer<typeof KitEmailsReadInputSchema>;
export type KitEmailsReadOutput = z.infer<typeof KitEmailsReadOutputSchema>;
export type KitEmailsSetReadStatusInput = z.infer<
  typeof KitEmailsSetReadStatusInputSchema
>;
export type KitEmailsSetReadStatusOutput = z.infer<
  typeof KitEmailsSetReadStatusOutputSchema
>;
