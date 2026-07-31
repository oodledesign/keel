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
  keyPoints: z.array(z.string().min(1)).optional().nullable(),
  notes: z.string().optional().nullable(),
  externalId: z.string().optional().nullable(),
  instructingClientId: z.string().uuid().optional().nullable(),
  county: z.string().optional().nullable(),
  latitude: z.number().optional().nullable(),
  longitude: z.number().optional().nullable(),
});

export const CreateListingUnitSchema = z.object({
  accountId: z.string().uuid(),
  listingId: z.string().uuid(),
  label: z.string().min(1, 'Label is required'),
  floorOrUnit: z.string().optional().nullable(),
  sizeSqft: z.number().min(0).optional().nullable(),
  measurementStandard: z.string().optional().nullable(),
  sortOrder: z.number().int().min(0).optional(),
  externalId: z.string().optional().nullable(),
});

export const UpdateListingUnitSchema = CreateListingUnitSchema.omit({
  accountId: true,
  listingId: true,
})
  .partial()
  .extend({
    unitId: z.string().uuid(),
    accountId: z.string().uuid(),
    label: z.string().min(1).optional(),
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

export const MEDIA_TYPES = [
  'image',
  'brochure',
  'floorplan',
  'epc',
  'video',
  'other',
] as const;

export type MediaType = (typeof MEDIA_TYPES)[number];

export const MEDIA_TYPE_LABELS: Record<MediaType, string> = {
  image: 'Image',
  brochure: 'Brochure',
  floorplan: 'Floorplan',
  epc: 'EPC',
  video: 'Video',
  other: 'Other',
};

export const CreateListingMediaSchema = z.object({
  accountId: z.string().uuid(),
  listingId: z.string().uuid(),
  mediaType: z.enum(MEDIA_TYPES).optional(),
  storagePath: z.string().min(1).optional().nullable(),
  externalUrl: z.string().url().optional().nullable(),
  fileName: z.string().optional().nullable(),
  mimeType: z.string().optional().nullable(),
  sortOrder: z.number().int().min(0).optional(),
  isCover: z.boolean().optional(),
});

export const SetListingMediaCoverSchema = z.object({
  mediaId: z.string().uuid(),
  listingId: z.string().uuid(),
  accountId: z.string().uuid(),
});

export const DeleteListingMediaSchema = z.object({
  mediaId: z.string().uuid(),
  accountId: z.string().uuid(),
});

export const DeleteListingUnitSchema = z.object({
  unitId: z.string().uuid(),
  accountId: z.string().uuid(),
});

export const CreateListingEnquirySchema = z.object({
  accountId: z.string().uuid(),
  listingId: z.string().uuid(),
  contactName: z.string().min(1).optional().nullable(),
  contactEmail: z.string().email().optional().nullable().or(z.literal('')),
  contactPhone: z.string().optional().nullable(),
  message: z.string().optional().nullable(),
  source: z
    .enum(['manual', 'website', 'rightmove', 'each', 'other'])
    .optional(),
  status: z.enum(['unactioned', 'on_schedule', 'archived']).optional(),
});

export const UpdateListingEnquirySchema = z.object({
  enquiryId: z.string().uuid(),
  accountId: z.string().uuid(),
  status: z.enum(['unactioned', 'on_schedule', 'archived']).optional(),
  contactName: z.string().min(1).optional().nullable(),
  contactEmail: z.string().email().optional().nullable().or(z.literal('')),
  contactPhone: z.string().optional().nullable(),
  message: z.string().optional().nullable(),
  source: z
    .enum(['manual', 'website', 'rightmove', 'each', 'other'])
    .optional(),
});

export type CreateListingMediaInput = z.infer<typeof CreateListingMediaSchema>;
export type SetListingMediaCoverInput = z.infer<
  typeof SetListingMediaCoverSchema
>;
export type CreateListingUnitInput = z.infer<typeof CreateListingUnitSchema>;
export type UpdateListingUnitInput = z.infer<typeof UpdateListingUnitSchema>;
export type CreateListingInput = z.infer<typeof CreateListingSchema>;
export type UpdateListingInput = z.infer<typeof UpdateListingSchema>;
export type CreateListingEnquiryInput = z.infer<
  typeof CreateListingEnquirySchema
>;
export type UpdateListingEnquiryInput = z.infer<
  typeof UpdateListingEnquirySchema
>;
