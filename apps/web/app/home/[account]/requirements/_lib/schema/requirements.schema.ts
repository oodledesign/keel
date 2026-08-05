import { z } from 'zod';

import { REQUIREMENT_STATUSES } from '~/lib/commercial/commercial-constants';

export const ListRequirementsSchema = z.object({
  accountId: z.string().uuid(),
  stage: z.enum(REQUIREMENT_STATUSES).optional(),
});

export const CreateRequirementSchema = z.object({
  accountId: z.string().uuid(),
  clientId: z.string().uuid().optional().nullable(),
  contactId: z.string().uuid().optional().nullable(),
  contactName: z.string().optional().nullable(),
  contactEmail: z.string().optional().nullable(),
  contactPhone: z.string().optional().nullable(),
  companyName: z.string().optional().nullable(),
  sector: z.string().optional().nullable(),
  tenure: z.enum(['rent', 'buy', 'both']).optional().nullable(),
  locationText: z.string().optional().nullable(),
  sizeMinSqft: z.number().min(0).optional().nullable(),
  sizeMaxSqft: z.number().min(0).optional().nullable(),
  budgetMinPence: z.number().int().min(0).optional().nullable(),
  budgetMaxPence: z.number().int().min(0).optional().nullable(),
  stage: z.enum(REQUIREMENT_STATUSES).default('new'),
  notes: z.string().optional().nullable(),
  source: z.string().optional().nullable(),
  /** When set after AI draft from enquiry, link the enquiry on create. */
  sourceEnquiryId: z.string().uuid().optional().nullable(),
});

export const DraftRequirementFromPasteSchema = z.object({
  accountId: z.string().uuid(),
  text: z.string().trim().min(1).max(12000),
});

export const DraftRequirementFromEnquirySchema = z.object({
  accountId: z.string().uuid(),
  enquiryId: z.string().uuid(),
});

export const UpdateRequirementSchema = CreateRequirementSchema.omit({
  accountId: true,
  sourceEnquiryId: true,
})
  .partial()
  .extend({
    requirementId: z.string().uuid(),
    accountId: z.string().uuid(),
  });

export const DeleteRequirementSchema = z.object({
  requirementId: z.string().uuid(),
  accountId: z.string().uuid(),
});

export type CreateRequirementInput = z.infer<typeof CreateRequirementSchema>;
export type UpdateRequirementInput = z.infer<typeof UpdateRequirementSchema>;

/** Prefill shape for AI / enquiry draft → confirm modal (client-safe). */
export type RequirementDraftPrefill = {
  companyName?: string | null;
  contactName?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  locationText?: string | null;
  sector?: string | null;
  tenure?: 'rent' | 'buy' | 'both' | null;
  sizeMinSqft?: number | null;
  sizeMaxSqft?: number | null;
  budgetMinPence?: number | null;
  budgetMaxPence?: number | null;
  notes?: string | null;
  source?: string | null;
};
