import { z } from 'zod';

import {
  DISPOSAL_TYPES,
  LISTING_STATUSES,
} from '~/lib/commercial/commercial-constants';

export const ListListingsSchema = z.object({
  accountId: z.string().uuid(),
  status: z.enum(LISTING_STATUSES).optional(),
});

export const GetListingSchema = z.object({
  listingId: z.string().uuid(),
  accountId: z.string().uuid(),
});

export const CreateListingSchema = z.object({
  accountId: z.string().uuid(),
  name: z.string().min(1, 'Name is required'),
  addressLine1: z.string().optional().nullable(),
  addressLine2: z.string().optional().nullable(),
  town: z.string().optional().nullable(),
  postcode: z.string().optional().nullable(),
  country: z.string().optional().nullable(),
  sector: z.string().optional().nullable(),
  tenure: z.string().optional().nullable(),
  disposalType: z.enum(DISPOSAL_TYPES).optional(),
  instructionNature: z.enum(['exclusive', 'joint']).optional(),
  status: z.enum(LISTING_STATUSES).optional(),
  askingRentPence: z.number().int().min(0).optional().nullable(),
  askingPricePence: z.number().int().min(0).optional().nullable(),
  rentFrequency: z.string().optional().nullable(),
  hideRentFromMarketing: z.boolean().optional(),
  sizeMinSqft: z.number().min(0).optional().nullable(),
  sizeMaxSqft: z.number().min(0).optional().nullable(),
  measurementStandard: z.string().optional().nullable(),
  useClass: z.string().optional().nullable(),
  availableFrom: z.string().optional().nullable(),
  epcBand: z.string().optional().nullable(),
  epcRating: z.number().int().optional().nullable(),
  summary: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  locationCopy: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  instructingClientId: z.string().uuid().optional().nullable(),
});

export const UpdateListingSchema = CreateListingSchema.omit({
  accountId: true,
})
  .partial()
  .extend({
    listingId: z.string().uuid(),
    accountId: z.string().uuid(),
    name: z.string().min(1).optional(),
  });

export const DeleteListingSchema = z.object({
  listingId: z.string().uuid(),
  accountId: z.string().uuid(),
});

export const SetLandlordShareSchema = z.object({
  listingId: z.string().uuid(),
  accountId: z.string().uuid(),
  enabled: z.boolean(),
});

export type CreateListingInput = z.infer<typeof CreateListingSchema>;
export type UpdateListingInput = z.infer<typeof UpdateListingSchema>;
