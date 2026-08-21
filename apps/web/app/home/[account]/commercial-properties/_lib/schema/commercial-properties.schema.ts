import { z } from 'zod';

import { PROPERTY_PARTY_ROLES } from '~/lib/commercial/commercial-constants';

export const ListCommercialPropertiesSchema = z.object({
  accountId: z.string().uuid(),
  query: z.string().max(200).optional(),
  includeArchived: z.boolean().optional(),
});

export const GetCommercialPropertySchema = z.object({
  accountId: z.string().uuid(),
  propertyId: z.string().uuid(),
});

export const CreateCommercialPropertySchema = z.object({
  accountId: z.string().uuid(),
  name: z.string().trim().min(1).max(300),
  addressLine1: z.string().trim().max(200).optional().nullable(),
  addressLine2: z.string().trim().max(200).optional().nullable(),
  town: z.string().trim().max(120).optional().nullable(),
  postcode: z.string().trim().max(20).optional().nullable(),
  country: z.string().trim().max(2).optional().nullable(),
  sector: z.string().trim().max(80).optional().nullable(),
  notes: z.string().trim().max(4000).optional().nullable(),
  latitude: z.number().nullable().optional(),
  longitude: z.number().nullable().optional(),
});

export const UpdateCommercialPropertySchema =
  CreateCommercialPropertySchema.extend({
    propertyId: z.string().uuid(),
    archived: z.boolean().optional(),
  });

export const SearchCommercialPropertiesSchema = z.object({
  accountId: z.string().uuid(),
  query: z.string().max(200).optional(),
});

export const AddCommercialPropertyPartySchema = z
  .object({
    accountId: z.string().uuid(),
    propertyId: z.string().uuid(),
    role: z.enum(PROPERTY_PARTY_ROLES),
    clientId: z.string().uuid().optional(),
    contactId: z.string().uuid().optional().nullable(),
    companyName: z.string().trim().min(1).max(200).optional(),
    contactName: z.string().trim().max(200).optional().nullable(),
    contactEmail: z
      .union([z.string().trim().email(), z.literal(''), z.null()])
      .optional(),
    contactPhone: z.string().trim().max(60).optional().nullable(),
  })
  .superRefine((data, ctx) => {
    if (!data.clientId && !data.companyName?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Select a contact or enter a company name',
        path: ['companyName'],
      });
    }
  });

export const RemoveCommercialPropertyPartySchema = z.object({
  accountId: z.string().uuid(),
  propertyId: z.string().uuid(),
  partyId: z.string().uuid(),
});

export const SearchPropertyPartyClientsSchema = z.object({
  accountId: z.string().uuid(),
  query: z.string().max(120).optional(),
  excludePropertyId: z.string().uuid().optional(),
  role: z.enum(PROPERTY_PARTY_ROLES).optional(),
});

export const LinkListingToPropertySchema = z.object({
  accountId: z.string().uuid(),
  listingId: z.string().uuid(),
  propertyId: z.string().uuid().nullable(),
});

export const CreatePropertyFromListingSchema = z.object({
  accountId: z.string().uuid(),
  listingId: z.string().uuid(),
});

export type ListCommercialPropertiesInput = z.infer<
  typeof ListCommercialPropertiesSchema
>;
export type CreateCommercialPropertyInput = z.infer<
  typeof CreateCommercialPropertySchema
>;
export type UpdateCommercialPropertyInput = z.infer<
  typeof UpdateCommercialPropertySchema
>;
export type AddCommercialPropertyPartyInput = z.infer<
  typeof AddCommercialPropertyPartySchema
>;
