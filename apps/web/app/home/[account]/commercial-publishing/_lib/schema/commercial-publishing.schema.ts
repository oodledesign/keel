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

export const SavePortalCredentialsSchema = z.object({
  accountId: z.string().uuid(),
  /** @deprecated Rightmove uses env OAuth; EACH uses a dedicated XML feed. */
  portal: z.enum(['rightmove', 'each']),
  branchId: z.string().optional().nullable(),
  networkId: z.string().optional().nullable(),
  username: z.string().optional(),
  secret: z.string().optional(),
});

export const TestPublishListingSchema = AccountIdSchema.extend({
  listingId: z.string().uuid().optional(),
  portal: z.enum(['property_hive', 'rightmove', 'each']),
  /** Workspace account_branches.id — probes that branch’s Rightmove ID when no listing. */
  accountBranchId: z.string().uuid().optional(),
});

export const EnsurePropertyHiveFeedSchema = AccountIdSchema;

export const RotatePropertyHiveFeedSchema = AccountIdSchema;

export const EnsureEachFeedSchema = AccountIdSchema;

export const RotateEachFeedSchema = AccountIdSchema;

export const SetEachListingFeedInclusionSchema = AccountIdSchema.extend({
  listingId: z.string().uuid(),
  enabled: z.boolean(),
});

export const SaveRightmoveWorkspaceBranchesSchema = z.object({
  accountId: z.string().uuid(),
  branches: z
    .array(
      z.object({
        id: z.string().uuid(),
        rightmoveBranchId: z
          .string()
          .trim()
          .max(40)
          .regex(/^\d*$/, 'Rightmove Branch ID must be numeric')
          .optional()
          .nullable(),
      }),
    )
    .min(1)
    .max(50),
});
