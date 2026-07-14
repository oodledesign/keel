'use server';

import { z } from 'zod';

import { enhanceAction } from '@kit/next/actions';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

import { createPropertiesService } from './properties.service';

function getService() {
  return createPropertiesService(getSupabaseServerClient());
}

const ListPropertiesSchema = z.object({
  accountId: z.string().uuid(),
});

const GetPropertySchema = z.object({
  propertyId: z.string().uuid(),
});

const MortgageFieldsSchema = z.object({
  mortgageLender: z.string().optional().nullable(),
  mortgageReference: z.string().optional().nullable(),
  mortgageBalance: z.number().int().min(0).optional().nullable(),
  mortgageInterestRate: z.number().min(0).max(100).optional().nullable(),
  mortgageMonthlyPayment: z.number().int().min(0).optional().nullable(),
  mortgageStartDate: z.string().optional().nullable(),
  mortgageEndDate: z.string().optional().nullable(),
  mortgageNotes: z.string().optional().nullable(),
});

const PropertyInputSchema = z
  .object({
    accountId: z.string().uuid(),
    name: z.string().min(1, 'Name is required'),
    address: z.string().optional().nullable(),
    propertyType: z
      .enum(['residential', 'commercial', 'land', 'other'])
      .default('residential'),
    status: z
      .enum(['active', 'vacant', 'maintenance', 'sold', 'archived'])
      .default('active'),
    bedrooms: z.number().int().min(0).optional().nullable(),
    bathrooms: z.number().min(0).optional().nullable(),
    squareFootage: z.number().int().min(0).optional().nullable(),
    purchaseDate: z.string().optional().nullable(),
    purchasePrice: z.number().int().min(0).optional().nullable(),
    currentValue: z.number().int().min(0).optional().nullable(),
    notes: z.string().optional().nullable(),
  })
  .merge(MortgageFieldsSchema);

const UpdatePropertySchema = PropertyInputSchema.extend({
  propertyId: z.string().uuid(),
}).omit({ accountId: true });

const DeletePropertySchema = z.object({
  propertyId: z.string().uuid(),
});

const ListValuationsSchema = z.object({
  propertyId: z.string().uuid(),
});

const UpsertValuationSchema = z.object({
  propertyId: z.string().uuid(),
  accountId: z.string().uuid(),
  valuedMonth: z.string().min(7),
  valueAmount: z.number().int().min(0),
  notes: z.string().optional().nullable(),
});

const DeleteValuationSchema = z.object({
  valuationId: z.string().uuid(),
});

export const listProperties = enhanceAction(
  async (input) => {
    const service = getService();
    return service.listProperties(input.accountId);
  },
  { schema: ListPropertiesSchema },
);

export const getProperty = enhanceAction(
  async (input) => {
    const service = getService();
    return service.getProperty(input.propertyId);
  },
  { schema: GetPropertySchema },
);

export const createProperty = enhanceAction(
  async (input) => {
    const service = getService();
    return service.createProperty(input);
  },
  { schema: PropertyInputSchema },
);

export const updateProperty = enhanceAction(
  async (input) => {
    const { propertyId, ...rest } = input;
    const service = getService();
    return service.updateProperty(propertyId, rest);
  },
  { schema: UpdatePropertySchema },
);

export const deleteProperty = enhanceAction(
  async (input) => {
    const service = getService();
    await service.deleteProperty(input.propertyId);
    return { success: true };
  },
  { schema: DeletePropertySchema },
);

export const listPropertyValuations = enhanceAction(
  async (input) => {
    const service = getService();
    return service.listValuations(input.propertyId);
  },
  { schema: ListValuationsSchema },
);

export const upsertPropertyValuation = enhanceAction(
  async (input) => {
    const client = getSupabaseServerClient();
    const {
      data: { user },
    } = await client.auth.getUser();
    const service = createPropertiesService(client);
    return service.upsertValuation({
      ...input,
      createdBy: user?.id ?? null,
    });
  },
  { schema: UpsertValuationSchema },
);

export const deletePropertyValuation = enhanceAction(
  async (input) => {
    const service = getService();
    await service.deleteValuation(input.valuationId);
    return { success: true };
  },
  { schema: DeleteValuationSchema },
);
