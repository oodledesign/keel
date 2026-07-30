import { z } from 'zod';

const AccountIdSchema = z.object({
  accountId: z.string().uuid(),
});

export const SavePropertyHiveCredentialsSchema = AccountIdSchema.extend({
  siteUrl: z.string().min(1, 'Site URL is required'),
  username: z.string().min(1, 'Username is required'),
  applicationPassword: z.string().optional(),
  officeId: z.string().optional().nullable(),
});

export const SavePortalCredentialsSchema = AccountIdSchema.extend({
  portal: z.enum(['rightmove', 'each']),
  branchId: z.string().min(1, 'Branch ID is required'),
  networkId: z.string().min(1, 'Network ID is required'),
  username: z.string().min(1, 'Username is required'),
  secret: z.string().optional(),
});

export const TestPublishListingSchema = AccountIdSchema.extend({
  listingId: z.string().uuid().optional(),
  portal: z.enum(['property_hive', 'rightmove', 'each']),
});

export const EnsurePropertyHiveFeedSchema = AccountIdSchema;

export const RotatePropertyHiveFeedSchema = AccountIdSchema;
