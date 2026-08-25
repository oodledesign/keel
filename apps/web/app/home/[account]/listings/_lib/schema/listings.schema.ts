import { z } from 'zod';

import {
  BREEAM_RATINGS,
  DISPOSAL_TYPES,
  LISTING_CONTROLLED_BY,
  LISTING_LET_TYPES,
  LISTING_PARTY_ROLES,
  LISTING_SIZE_ACCURACIES,
  LISTING_SIZE_BREAKDOWNS,
  LISTING_STATUSES,
} from '~/lib/commercial/commercial-constants';

export const ListListingsSchema = z.object({
  accountId: z.string().uuid(),
  status: z.enum(LISTING_STATUSES).optional(),
  /** When set, filter to any of these statuses (takes precedence over `status`). */
  statuses: z.array(z.enum(LISTING_STATUSES)).min(1).max(20).optional(),
  search: z.string().trim().max(200).optional(),
  /** Filter to a workspace office (`account_branches.id`). Omit for all offices. */
  accountBranchId: z.string().uuid().optional(),
  /** Filter to disposals where this user is an acting agent. */
  actingAgentUserId: z.string().uuid().optional(),
  page: z.number().int().min(1).optional(),
  pageSize: z.number().int().min(1).max(500).optional(),
});

export const CountUnassignedListingsSchema = z.object({
  accountId: z.string().uuid(),
  status: z.enum(LISTING_STATUSES).optional(),
  statuses: z.array(z.enum(LISTING_STATUSES)).min(1).max(20).optional(),
});

export const CountSuggestedMatchesSchema = z.object({
  accountId: z.string().uuid(),
  listingIds: z.array(z.string().uuid()).max(500),
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
  isInstructed: z.boolean().optional(),
  termsOfEngagement: z.enum(['yes', 'no', 'pending']).optional().nullable(),
  restrictAccessToAssigned: z.boolean().optional(),
  hideLandlordFromMarketing: z.boolean().optional(),
  commercialPropertyId: z.string().uuid().optional().nullable(),
  referenceNumber: z.string().trim().max(120).optional().nullable(),
  projectCode: z.string().trim().max(120).optional().nullable(),
  accountBranchId: z.string().uuid().optional().nullable(),
  onMarketAt: z.string().optional().nullable(),
  offMarketAt: z.string().optional().nullable(),
  averageFloorPlateSqft: z.number().min(0).optional().nullable(),
  sizeBreakdown: z.enum(LISTING_SIZE_BREAKDOWNS).optional().nullable(),
  controlledBy: z.enum(LISTING_CONTROLLED_BY).optional().nullable(),
  sizeAccuracy: z.enum(LISTING_SIZE_ACCURACIES).optional().nullable(),
  termsInternal: z.string().trim().max(2000).optional().nullable(),
  breeamRating: z.enum(BREEAM_RATINGS).optional().nullable(),
  conditionDescription: z.string().trim().max(2000).optional().nullable(),
  status: z.enum(LISTING_STATUSES).optional(),
  askingRentPence: z.number().int().min(0).optional().nullable(),
  askingRentToPence: z.number().int().min(0).optional().nullable(),
  askingPricePence: z.number().int().min(0).optional().nullable(),
  rentFrequency: z.string().optional().nullable(),
  hideRentFromMarketing: z.boolean().optional(),
  hidePriceFromMarketing: z.boolean().optional(),
  serviceChargePerSqft: z.number().min(0).optional().nullable(),
  ratesPayablePerSqft: z.number().min(0).optional().nullable(),
  estateChargePerSqft: z.number().min(0).optional().nullable(),
  sizeMinSqft: z.number().min(0).optional().nullable(),
  sizeMaxSqft: z.number().min(0).optional().nullable(),
  measurementStandard: z.string().optional().nullable(),
  useClass: z.string().optional().nullable(),
  availableFrom: z.string().optional().nullable(),
  letType: z.enum(LISTING_LET_TYPES).optional().nullable(),
  letContractLengthMonths: z
    .number()
    .int()
    .min(0)
    .max(1200)
    .optional()
    .nullable(),
  epcBand: z.string().optional().nullable(),
  epcRating: z.number().int().optional().nullable(),
  possession: z.string().trim().max(200).optional().nullable(),
  buildStatus: z.string().trim().max(200).optional().nullable(),
  planningStatus: z.string().trim().max(200).optional().nullable(),
  fittedSpace: z.boolean().optional().nullable(),
  landSizeMin: z.number().min(0).optional().nullable(),
  landSizeMax: z.number().min(0).optional().nullable(),
  landSizeMetric: z
    .enum(['hectare', 'acres', 'sqft', 'sqm'])
    .optional()
    .nullable(),
  insuranceType: z.string().trim().max(200).optional().nullable(),
  streetViewPanoId: z.string().trim().max(120).optional().nullable(),
  streetViewHeading: z.number().optional().nullable(),
  streetViewPitch: z.number().optional().nullable(),
  streetViewZoom: z.number().optional().nullable(),
  summary: z.string().max(140).optional().nullable(),
  description: z.string().optional().nullable(),
  locationCopy: z.string().optional().nullable(),
  keyPoints: z.array(z.string().min(1)).optional().nullable(),
  amenities: z
    .array(z.string().trim().min(1).max(80))
    .max(50)
    .optional()
    .nullable(),
  parkingAvailable: z.boolean().optional(),
  parkingSpaces: z.number().int().min(0).max(100_000).optional().nullable(),
  marketingSections: z
    .array(
      z.object({
        id: z.string().min(1).max(80),
        kind: z.enum([
          'promo',
          'specifications',
          'viewings',
          'terms',
          'custom',
        ]),
        title: z.string().trim().min(1).max(120),
        body: z.string().max(20000),
      }),
    )
    .max(20)
    .optional()
    .nullable(),
  websiteUrl: z
    .union([z.string().trim().url().max(500), z.literal(''), z.null()])
    .optional(),
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
  description: z.string().trim().max(2000).optional().nullable(),
  partFloor: z.boolean().optional(),
  sector: z.string().trim().max(200).optional().nullable(),
  tenure: z.string().trim().max(200).optional().nullable(),
  status: z.string().trim().max(120).optional().nullable(),
  sizeSqft: z.number().min(0).optional().nullable(),
  measurementStandard: z.string().optional().nullable(),
  askingRentPence: z.number().int().min(0).optional().nullable(),
  rentPerSqft: z.number().min(0).optional().nullable(),
  serviceChargePerSqft: z.number().min(0).optional().nullable(),
  ratesPayablePerSqft: z.number().min(0).optional().nullable(),
  estateChargePerSqft: z.number().min(0).optional().nullable(),
  epcBand: z.string().trim().max(20).optional().nullable(),
  possession: z.string().trim().max(200).optional().nullable(),
  buildStatus: z.string().trim().max(200).optional().nullable(),
  planningStatus: z.string().trim().max(200).optional().nullable(),
  fittedSpace: z.boolean().optional().nullable(),
  sizeAccuracy: z.enum(LISTING_SIZE_ACCURACIES).optional().nullable(),
  notes: z.string().trim().max(4000).optional().nullable(),
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

export const DuplicateListingSchema = z.object({
  listingId: z.string().uuid(),
  accountId: z.string().uuid(),
  accountSlug: z.string().min(1),
});

export const ArchiveListingSchema = z.object({
  listingId: z.string().uuid(),
  accountId: z.string().uuid(),
});

export const BackfillListingLocationsSchema = z.object({
  accountId: z.string().uuid(),
  limit: z.number().int().min(1).max(100).optional(),
});

export const SetLandlordShareSchema = z.object({
  listingId: z.string().uuid(),
  accountId: z.string().uuid(),
  enabled: z.boolean(),
});

export const SetBrochureShareSchema = z.object({
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
  'aerial',
  'goad',
] as const;

export type MediaType = (typeof MEDIA_TYPES)[number];

export const MEDIA_TYPE_LABELS: Record<MediaType, string> = {
  image: 'Photo',
  brochure: 'Brochure',
  floorplan: 'Floor plan',
  epc: 'EPC',
  video: 'Video',
  other: 'Other',
  aerial: 'Aerial / drone',
  goad: 'Goad plan',
};

export const MARKETING_SECTION_KINDS = [
  'promo',
  'specifications',
  'viewings',
  'terms',
  'custom',
] as const;

export type MarketingSectionKind = (typeof MARKETING_SECTION_KINDS)[number];

export const MARKETING_SECTION_KIND_LABELS: Record<
  MarketingSectionKind,
  string
> = {
  promo: 'Promo message',
  specifications: 'Specifications',
  viewings: 'Viewings',
  terms: 'Terms',
  custom: 'Custom field',
};

export const SUGGESTED_LISTING_AMENITIES = [
  'ESG Credentials',
  'Travel Times',
  'Staff Amenities',
  'All Retail',
  'Air Conditioning',
  'Raised Floors',
  'Bike Storage',
  'Showers',
  'Reception',
  'Security',
  'Loading Bay',
  'Yard',
  'EV Charging',
] as const;

export const CreateListingMediaSchema = z
  .object({
    accountId: z.string().uuid(),
    listingId: z.string().uuid(),
    mediaType: z.enum(MEDIA_TYPES).optional(),
    storagePath: z.string().min(1).optional().nullable(),
    externalUrl: z
      .union([z.string().trim().url().max(2000), z.literal(''), z.null()])
      .optional(),
    fileName: z.string().optional().nullable(),
    mimeType: z.string().optional().nullable(),
    sortOrder: z.number().int().min(0).optional(),
    isCover: z.boolean().optional(),
    isPrivate: z.boolean().optional(),
  })
  .superRefine((data, ctx) => {
    const hasPath = Boolean(data.storagePath?.trim());
    const hasUrl = Boolean(
      data.externalUrl && String(data.externalUrl).trim().length > 0,
    );
    if (!hasPath && !hasUrl) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Provide a file or external URL',
        path: ['externalUrl'],
      });
    }
  });

export const SetListingMediaCoverSchema = z.object({
  mediaId: z.string().uuid(),
  listingId: z.string().uuid(),
  accountId: z.string().uuid(),
});

export const UpdateListingMediaSchema = z
  .object({
    mediaId: z.string().uuid(),
    listingId: z.string().uuid(),
    accountId: z.string().uuid(),
    fileName: z.string().trim().min(1).max(200).optional(),
    storagePath: z.string().min(1).optional(),
    mimeType: z.string().trim().max(120).optional().nullable(),
    mediaType: z.enum(MEDIA_TYPES).optional(),
  })
  .refine(
    (data) =>
      data.fileName !== undefined ||
      data.storagePath !== undefined ||
      data.mimeType !== undefined ||
      data.mediaType !== undefined,
    { message: 'Provide at least one field to update' },
  );

export const DeleteListingMediaSchema = z.object({
  mediaId: z.string().uuid(),
  listingId: z.string().uuid(),
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
    .enum(['manual', 'website', 'rightmove', 'each', 'other', 'brochure'])
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
    .enum(['manual', 'website', 'rightmove', 'each', 'other', 'brochure'])
    .optional(),
  requirementId: z.string().uuid().optional().nullable(),
});

export const ListListingMembersSchema = z.object({
  accountSlug: z.string().min(1),
});

export const ListWorkspaceTeamsSchema = z.object({
  accountId: z.string().uuid(),
});

export const CreateWorkspaceTeamSchema = z.object({
  accountId: z.string().uuid(),
  name: z.string().min(1).max(80),
});

export const GetListingAssignmentSchema = z.object({
  listingId: z.string().uuid(),
  accountId: z.string().uuid(),
  accountSlug: z.string().min(1),
});

export const UpdateListingAssignmentSchema = z.object({
  listingId: z.string().uuid(),
  accountId: z.string().uuid(),
  accountSlug: z.string().min(1),
  actingAgentUserIds: z.array(z.string().uuid()).optional(),
  paUserId: z.string().uuid().nullable().optional(),
  recordOwnerUserId: z.string().uuid().nullable().optional(),
  teamId: z.string().uuid().nullable().optional(),
  accountBranchId: z.string().uuid().nullable().optional(),
  restrictAccessToAssigned: z.boolean().optional(),
});

export const ListListingCoAgentsSchema = z.object({
  listingId: z.string().uuid(),
  accountId: z.string().uuid(),
});

export const SearchCoAgentClientsSchema = z.object({
  accountId: z.string().uuid(),
  query: z.string().max(120).optional(),
  excludeListingId: z.string().uuid().optional(),
});

export const AddListingCoAgentSchema = z
  .object({
    listingId: z.string().uuid(),
    accountId: z.string().uuid(),
    clientId: z.string().uuid().optional(),
    /** Create a new workspace client (agency) when clientId is omitted. */
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
        message: 'Select a client or enter a company name',
        path: ['companyName'],
      });
    }
  });

export const RemoveListingCoAgentSchema = z.object({
  listingId: z.string().uuid(),
  accountId: z.string().uuid(),
  coAgentId: z.string().uuid(),
});

export const ListListingPartiesSchema = z.object({
  listingId: z.string().uuid(),
  accountId: z.string().uuid(),
  role: z.enum(LISTING_PARTY_ROLES).optional(),
});

export const SearchListingPartyClientsSchema = z.object({
  accountId: z.string().uuid(),
  query: z.string().max(120).optional(),
  excludeListingId: z.string().uuid().optional(),
  role: z.enum(LISTING_PARTY_ROLES).optional(),
});

export const AddListingPartySchema = z
  .object({
    listingId: z.string().uuid(),
    accountId: z.string().uuid(),
    role: z.enum(LISTING_PARTY_ROLES),
    clientId: z.string().uuid().optional(),
    contactId: z.string().uuid().optional().nullable(),
    companyName: z.string().trim().min(1).max(200).optional(),
    contactName: z.string().trim().max(200).optional().nullable(),
    contactEmail: z
      .union([z.string().trim().email(), z.literal(''), z.null()])
      .optional(),
    contactPhone: z.string().trim().max(60).optional().nullable(),
    isPrivate: z.boolean().optional(),
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

export const RemoveListingPartySchema = z.object({
  listingId: z.string().uuid(),
  accountId: z.string().uuid(),
  partyId: z.string().uuid(),
});

export const UpdateListingPartySchema = z.object({
  listingId: z.string().uuid(),
  accountId: z.string().uuid(),
  partyId: z.string().uuid(),
  isPrivate: z.boolean().optional(),
});

export type CreateListingMediaInput = z.infer<typeof CreateListingMediaSchema>;
export type SetListingMediaCoverInput = z.infer<
  typeof SetListingMediaCoverSchema
>;
export type UpdateListingMediaInput = z.infer<typeof UpdateListingMediaSchema>;
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
export type UpdateListingAssignmentInput = z.infer<
  typeof UpdateListingAssignmentSchema
>;
export type CreateWorkspaceTeamInput = z.infer<
  typeof CreateWorkspaceTeamSchema
>;
export type AddListingCoAgentInput = z.infer<typeof AddListingCoAgentSchema>;
export type RemoveListingCoAgentInput = z.infer<
  typeof RemoveListingCoAgentSchema
>;
export type SearchCoAgentClientsInput = z.infer<
  typeof SearchCoAgentClientsSchema
>;
export type AddListingPartyInput = z.infer<typeof AddListingPartySchema>;
export type RemoveListingPartyInput = z.infer<typeof RemoveListingPartySchema>;
export type UpdateListingPartyInput = z.infer<typeof UpdateListingPartySchema>;
export type SearchListingPartyClientsInput = z.infer<
  typeof SearchListingPartyClientsSchema
>;
