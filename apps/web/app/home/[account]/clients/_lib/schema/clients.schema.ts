import { z } from 'zod';

const optionalString = z.string().optional();
const optionalNullableString = z.string().nullable().optional();

export const ListClientsSchema = z.object({
  accountId: z.string().uuid(),
  search: z.string().optional(),
  page: z.coerce.number().int().min(1).optional().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).optional().default(20),
});

export const GetClientSchema = z.object({
  accountId: z.string().uuid(),
  clientId: z.string().uuid(),
});

export const CreateClientSchema = z.object({
  accountId: z.string().uuid(),
  client_type: z.enum(['individual', 'business']).default('business'),
  first_name: z.string().min(1, 'First name is required'),
  last_name: optionalString,
  company_name: optionalString,
  email: optionalString,
  phone: optionalString,
  address_line_1: optionalString,
  address_line_2: optionalString,
  city: optionalString,
  postcode: optionalString,
  country: optionalString,
});

export const UpdateClientSchema = z.object({
  accountId: z.string().uuid(),
  clientId: z.string().uuid(),
  first_name: z.string().min(1).optional(),
  last_name: optionalNullableString,
  company_name: optionalNullableString,
  email: optionalNullableString,
  phone: optionalNullableString,
  address_line_1: optionalNullableString,
  address_line_2: optionalNullableString,
  city: optionalNullableString,
  postcode: optionalNullableString,
  country: optionalNullableString,
});

export const DeleteClientSchema = z.object({
  accountId: z.string().uuid(),
  clientId: z.string().uuid(),
});

export const ListNotesSchema = z.object({
  accountId: z.string().uuid(),
  clientId: z.string().uuid(),
});

export const CreateNoteSchema = z.object({
  accountId: z.string().uuid(),
  clientId: z.string().uuid(),
  note: z.string().min(1, 'Note cannot be empty'),
});

export const DeleteNoteSchema = z.object({
  accountId: z.string().uuid(),
  noteId: z.string().uuid(),
});

export const GetJobHistorySchema = z.object({
  accountId: z.string().uuid(),
  clientId: z.string().uuid(),
});

export const ListClientInvoicesSchema = z.object({
  accountId: z.string().uuid(),
  clientId: z.string().uuid(),
});

// ─── Contact schemas ──────────────────────────────────────────────────────────
export const ListContactsSchema = z.object({
  clientId: z.string().uuid(),
});

export const ListAccountContactsSchema = z.object({
  accountId: z.string().uuid(),
  clientId: z.string().uuid(),
  query: z.string().optional(),
});

export const CreateContactSchema = z.object({
  accountId: z.string().uuid(),
  clientId: z.string().uuid(),
  fullName: z.string().min(1, 'Name is required'),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  role: z.string().optional(),
  isPrimary: z.boolean().optional().default(false),
});

export const LinkContactSchema = z.object({
  accountId: z.string().uuid(),
  clientId: z.string().uuid(),
  contactId: z.string().uuid(),
  role: z.string().optional(),
  isPrimary: z.boolean().optional().default(false),
});

export const DeleteContactSchema = z.object({
  clientId: z.string().uuid(),
  contactId: z.string().uuid(),
});

export type ListClientsInput = z.infer<typeof ListClientsSchema>;
export type GetClientInput = z.infer<typeof GetClientSchema>;
export type CreateClientInput = z.infer<typeof CreateClientSchema>;
export type UpdateClientInput = z.infer<typeof UpdateClientSchema>;
export type DeleteClientInput = z.infer<typeof DeleteClientSchema>;
export type ListNotesInput = z.infer<typeof ListNotesSchema>;
export type CreateNoteInput = z.infer<typeof CreateNoteSchema>;
export type DeleteNoteInput = z.infer<typeof DeleteNoteSchema>;
export type GetJobHistoryInput = z.infer<typeof GetJobHistorySchema>;
export type ListClientInvoicesInput = z.infer<typeof ListClientInvoicesSchema>;
export type ListContactsInput = z.infer<typeof ListContactsSchema>;
export type ListAccountContactsInput = z.infer<typeof ListAccountContactsSchema>;
export type CreateContactInput = z.infer<typeof CreateContactSchema>;
export type LinkContactInput = z.infer<typeof LinkContactSchema>;
export type DeleteContactInput = z.infer<typeof DeleteContactSchema>;
