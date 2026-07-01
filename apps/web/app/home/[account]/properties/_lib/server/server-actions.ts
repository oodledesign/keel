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

const PropertyInputSchema = z.object({
  accountId: z.string().uuid(),
  name: z.string().min(1, 'Name is required'),
  address: z.string().optional().nullable(),
  propertyType: z.enum(['residential', 'commercial', 'land', 'other']).default('residential'),
  status: z.enum(['active', 'vacant', 'maintenance', 'sold', 'archived']).default('active'),
  bedrooms: z.number().int().min(0).optional().nullable(),
  bathrooms: z.number().min(0).optional().nullable(),
  squareFootage: z.number().int().min(0).optional().nullable(),
  purchaseDate: z.string().optional().nullable(),
  purchasePrice: z.number().int().min(0).optional().nullable(),
  currentValue: z.number().int().min(0).optional().nullable(),
  notes: z.string().optional().nullable(),
});

const UpdatePropertySchema = PropertyInputSchema.extend({
  propertyId: z.string().uuid(),
}).omit({ accountId: true });

const DeletePropertySchema = z.object({
  propertyId: z.string().uuid(),
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
