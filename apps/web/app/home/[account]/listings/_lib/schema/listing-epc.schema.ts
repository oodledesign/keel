import { z } from 'zod';

const ListingEpcAccountSchema = z.object({
  accountId: z.string().uuid(),
  listingId: z.string().uuid(),
});

export const SearchListingEpcSchema = ListingEpcAccountSchema.extend({
  address: z.string().max(500).nullable().optional(),
  postcode: z.string().max(16).nullable().optional(),
  uprn: z.string().max(20).nullable().optional(),
});

export const AttachListingEpcSchema = ListingEpcAccountSchema.extend({
  certificateNumber: z
    .string()
    .regex(
      /^[0-9]{4}-[0-9]{4}-[0-9]{4}-[0-9]{4}-[0-9]{4}$/,
      'Certificate number must be 20 digits',
    ),
});

export const RefreshListingEpcSchema = ListingEpcAccountSchema;

export type SearchListingEpcInput = z.infer<typeof SearchListingEpcSchema>;
export type AttachListingEpcInput = z.infer<typeof AttachListingEpcSchema>;
export type RefreshListingEpcInput = z.infer<typeof RefreshListingEpcSchema>;
