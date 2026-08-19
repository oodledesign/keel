import { z } from 'zod';

export const PublicRequirementFormSubmitSchema = z.object({
  token: z.string().min(16).max(128),
  contactName: z.string().min(1).max(120),
  contactEmail: z.string().email().max(255),
  contactPhone: z.string().max(40).optional().nullable(),
  companyName: z.string().max(160).optional().nullable(),
  branchId: z.string().uuid().optional().nullable(),
  sector: z.string().max(80).optional().nullable(),
  tenure: z.enum(['rent', 'buy', 'both']).optional().nullable(),
  locationText: z.string().max(300).optional().nullable(),
  searchRadiusMiles: z.number().min(0).max(100).optional().nullable(),
  sizeMinSqft: z.number().nonnegative().optional().nullable(),
  sizeMaxSqft: z.number().nonnegative().optional().nullable(),
  budgetMinPence: z.number().int().nonnegative().optional().nullable(),
  budgetMaxPence: z.number().int().nonnegative().optional().nullable(),
  notes: z.string().max(4000).optional().nullable(),
  marketingOptIn: z.literal(true),
});

export type PublicRequirementFormSubmitInput = z.infer<
  typeof PublicRequirementFormSubmitSchema
>;
