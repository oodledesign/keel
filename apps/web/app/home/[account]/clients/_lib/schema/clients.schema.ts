import { z } from 'zod';

import { composeContactFullName } from '~/lib/clients/contact-roles';

const optionalString = z.string().optional();
const optionalNullableString = z.string().nullable().optional();
const optionalEmail = z
  .union([z.string().email(), z.literal('')])
  .optional()
  .transform((value) => (value ? value : undefined));

const ContactEmailAddressSchema = z.object({
  email: z.string().trim().email(),
  label: z.enum(['work', 'personal', 'billing', 'other']).default('work'),
  isPrimary: z.boolean().default(false),
});

const ContactEmailAddressesSchema = z
  .array(ContactEmailAddressSchema)
  .max(10, 'A contact can have at most 10 email addresses')
  .superRefine((addresses, ctx) => {
    const normalized = addresses.map((address) => address.email.toLowerCase());
    if (new Set(normalized).size !== normalized.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Email addresses must be unique',
      });
    }

    if (addresses.filter((address) => address.isPrimary).length > 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Only one email address can be primary',
      });
    }
  });

export const ListClientsSchema = z.object({
  accountId: z.string().uuid(),
  search: z.string().optional(),
  page: z.coerce.number().int().min(1).optional().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).optional().default(20),
  archived: z.coerce.boolean().optional(),
});

export const GetClientSchema = z.object({
  accountId: z.string().uuid(),
  clientId: z.string().uuid(),
});

const InitialContactSchema = z.object({
  firstName: z.string().min(1, 'Contact first name is required'),
  lastName: optionalString,
  email: optionalEmail,
  phone: optionalString,
  role: optionalString,
  isPrimary: z.boolean().optional().default(true),
});

export const CreateClientSchema = z
  .object({
    accountId: z.string().uuid(),
    client_type: z.enum(['individual', 'business']).default('business'),
    first_name: optionalString,
    last_name: optionalString,
    company_name: optionalString,
    email: optionalString,
    phone: optionalString,
    address_line_1: optionalString,
    address_line_2: optionalString,
    city: optionalString,
    postcode: optionalString,
    country: optionalString,
    /** Primary contact created with a new business client. */
    contact: InitialContactSchema.optional(),
  })
  .superRefine((data, ctx) => {
    if (data.client_type === 'individual') {
      if (!data.first_name?.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'First name is required',
          path: ['first_name'],
        });
      }
      return;
    }

    if (!data.company_name?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Company name is required',
        path: ['company_name'],
      });
    }
  });

export const UpdateClientSchema = z.object({
  accountId: z.string().uuid(),
  clientId: z.string().uuid(),
  accountSlug: z.string().min(1).optional(),
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

export const RestoreClientSchema = z.object({
  accountId: z.string().uuid(),
  clientId: z.string().uuid(),
});

export const DestroyClientSchema = z.object({
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
  accountId: z.string().uuid(),
  clientId: z.string().uuid(),
});

export const ListAccountContactsSchema = z.object({
  accountId: z.string().uuid(),
  clientId: z.string().uuid(),
  query: z.string().optional(),
});

export const CreateContactSchema = z
  .object({
    accountId: z.string().uuid(),
    clientId: z.string().uuid(),
    firstName: optionalString,
    lastName: optionalString,
    /** Legacy single-field name (meetings / older callers). */
    fullName: optionalString,
    email: optionalEmail,
    emails: ContactEmailAddressesSchema.optional(),
    phone: optionalString,
    role: optionalString,
    isPrimary: z.boolean().optional().default(false),
  })
  .superRefine((data, ctx) => {
    const name = composeContactFullName({
      firstName: data.firstName,
      lastName: data.lastName,
      fullName: data.fullName,
    });
    if (!name) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'First name is required',
        path: ['firstName'],
      });
    }
  });

export const LinkContactSchema = z.object({
  accountId: z.string().uuid(),
  clientId: z.string().uuid(),
  contactId: z.string().uuid(),
  role: optionalString,
  isPrimary: z.boolean().optional().default(false),
});

export const SetPrimaryContactSchema = z.object({
  accountId: z.string().uuid(),
  clientId: z.string().uuid(),
  contactId: z.string().uuid(),
});

export const UpdateContactLinkSchema = z.object({
  accountId: z.string().uuid(),
  clientId: z.string().uuid(),
  contactId: z.string().uuid(),
  role: optionalNullableString,
});

export const UpdateContactSchema = z
  .object({
    accountId: z.string().uuid(),
    clientId: z.string().uuid(),
    contactId: z.string().uuid(),
    firstName: optionalString,
    lastName: optionalNullableString,
    fullName: optionalString,
    email: z
      .union([z.string().email(), z.literal(''), z.null()])
      .optional()
      .transform((value) =>
        value === '' || value === undefined ? null : value,
      ),
    emails: ContactEmailAddressesSchema.optional(),
    phone: optionalNullableString,
    role: optionalNullableString,
  })
  .superRefine((data, ctx) => {
    const name = composeContactFullName({
      firstName: data.firstName,
      lastName: data.lastName,
      fullName: data.fullName,
    });
    if (!name) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'First name is required',
        path: ['firstName'],
      });
    }
  });

export const DeleteContactSchema = z.object({
  accountId: z.string().uuid(),
  clientId: z.string().uuid(),
  contactId: z.string().uuid(),
});

export const ListWorkspaceContactsSchema = z.object({
  accountId: z.string().uuid(),
});

export const CreateWorkspaceContactSchema = z
  .object({
    accountId: z.string().uuid(),
    firstName: optionalString,
    lastName: optionalString,
    fullName: optionalString,
    email: optionalEmail,
    phone: optionalString,
    linkClientId: z.string().uuid().optional(),
  })
  .superRefine((data, ctx) => {
    const name = composeContactFullName({
      firstName: data.firstName,
      lastName: data.lastName,
      fullName: data.fullName,
    });
    if (!name) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Name is required',
        path: ['fullName'],
      });
    }
  });

export type ListClientsInput = z.infer<typeof ListClientsSchema>;
export type GetClientInput = z.infer<typeof GetClientSchema>;
export type CreateClientInput = z.infer<typeof CreateClientSchema>;
export type UpdateClientInput = z.infer<typeof UpdateClientSchema>;
export type DeleteClientInput = z.infer<typeof DeleteClientSchema>;
export type RestoreClientInput = z.infer<typeof RestoreClientSchema>;
export type DestroyClientInput = z.infer<typeof DestroyClientSchema>;
export type ListNotesInput = z.infer<typeof ListNotesSchema>;
export type CreateNoteInput = z.infer<typeof CreateNoteSchema>;
export type DeleteNoteInput = z.infer<typeof DeleteNoteSchema>;
export type GetJobHistoryInput = z.infer<typeof GetJobHistorySchema>;
export type ListClientInvoicesInput = z.infer<typeof ListClientInvoicesSchema>;
export type ListContactsInput = z.infer<typeof ListContactsSchema>;
export type ListAccountContactsInput = z.infer<
  typeof ListAccountContactsSchema
>;
export type CreateContactInput = z.infer<typeof CreateContactSchema>;
export type LinkContactInput = z.infer<typeof LinkContactSchema>;
export type SetPrimaryContactInput = z.infer<typeof SetPrimaryContactSchema>;
export type UpdateContactLinkInput = z.infer<typeof UpdateContactLinkSchema>;
export type UpdateContactInput = z.infer<typeof UpdateContactSchema>;
export type DeleteContactInput = z.infer<typeof DeleteContactSchema>;
export type ListWorkspaceContactsInput = z.infer<
  typeof ListWorkspaceContactsSchema
>;
export type CreateWorkspaceContactInput = z.infer<
  typeof CreateWorkspaceContactSchema
>;
