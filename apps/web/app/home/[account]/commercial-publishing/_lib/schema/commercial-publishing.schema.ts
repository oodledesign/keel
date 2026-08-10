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

export const SavePortalCredentialsSchema = z
  .object({
    accountId: z.string().uuid(),
    portal: z.enum(['rightmove', 'each']),
    branchId: z.string().min(1, 'Branch ID is required'),
    networkId: z.string().optional().nullable(),
    username: z.string().optional(),
    secret: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.portal === 'each') {
      if (!data.networkId?.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Network ID is required',
          path: ['networkId'],
        });
      }
      if (!data.username?.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Username is required',
          path: ['username'],
        });
      }
    }
  });

export const TestPublishListingSchema = AccountIdSchema.extend({
  listingId: z.string().uuid().optional(),
  portal: z.enum(['property_hive', 'rightmove', 'each']),
});

export const EnsurePropertyHiveFeedSchema = AccountIdSchema;

export const RotatePropertyHiveFeedSchema = AccountIdSchema;
