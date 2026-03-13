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
