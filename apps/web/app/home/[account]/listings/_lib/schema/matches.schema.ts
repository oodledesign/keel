import { z } from 'zod';

import { INTEREST_STATUSES } from '~/lib/commercial/commercial-constants';

export const ListMatchesForListingSchema = z.object({
  accountId: z.string().uuid(),
  listingId: z.string().uuid(),
  lastDays: z.number().int().min(1).max(365).optional(),
  sector: z.string().trim().min(1).max(120).optional().nullable(),
  sizeMinSqft: z.number().min(0).optional().nullable(),
  sizeMaxSqft: z.number().min(0).optional().nullable(),
});

export const ListMatchesForRequirementSchema = z.object({
  accountId: z.string().uuid(),
  requirementId: z.string().uuid(),
  lastDays: z.number().int().min(1).max(365).optional(),
});

export const CreateMatchSchema = z.object({
  accountId: z.string().uuid(),
  listingId: z.string().uuid(),
  requirementId: z.string().uuid(),
  status: z.enum(INTEREST_STATUSES).optional(),
  notes: z.string().trim().max(4000).optional().nullable(),
});

export const UpdateMatchSchema = z.object({
  accountId: z.string().uuid(),
  matchId: z.string().uuid(),
  status: z.enum(INTEREST_STATUSES).optional(),
  notes: z.string().trim().max(4000).optional().nullable(),
});

export const DeleteMatchSchema = z.object({
  accountId: z.string().uuid(),
  matchId: z.string().uuid(),
});

export const SuggestMatchesSchema = z
  .object({
    accountId: z.string().uuid(),
    listingId: z.string().uuid().optional(),
    requirementId: z.string().uuid().optional(),
    minScore: z.number().min(0).max(100).optional(),
    limit: z.number().int().min(1).max(40).optional(),
    withAi: z.boolean().optional(),
    aiMode: z.enum(['explain', 'triage']).optional(),
  })
  .refine((v) => Boolean(v.listingId) || Boolean(v.requirementId), {
    message: 'Provide listingId or requirementId',
  });

export const MatchDigestSchema = z.object({
  accountId: z.string().uuid(),
  minScore: z.number().min(0).max(100).optional(),
  limit: z.number().int().min(1).max(20).optional(),
  requirementDays: z.number().int().min(1).max(365).optional(),
});

export const ExplainSuggestionsSchema = z
  .object({
    accountId: z.string().uuid(),
    listingId: z.string().uuid().optional(),
    requirementId: z.string().uuid().optional(),
    mode: z.enum(['explain', 'triage']).default('explain'),
    limit: z.number().int().min(1).max(12).optional(),
    minScore: z.number().min(0).max(100).optional(),
  })
  .refine((v) => Boolean(v.listingId) || Boolean(v.requirementId), {
    message: 'Provide listingId or requirementId',
  });

export const DraftMatchOutreachSchema = z.object({
  accountId: z.string().uuid(),
  listingId: z.string().uuid(),
  requirementId: z.string().uuid(),
  score: z.number().min(0).max(100).optional(),
  reasons: z.array(z.string().max(200)).max(8).optional(),
  listingName: z.string().max(200).optional(),
  listingSector: z.string().max(120).nullable().optional(),
  listingTown: z.string().max(120).nullable().optional(),
  listingDisposalType: z
    .enum(['to_let', 'for_sale', 'investment', 'to_let_and_for_sale'])
    .optional(),
  listingSizeMinSqft: z.number().nullable().optional(),
  listingSizeMaxSqft: z.number().nullable().optional(),
  requirementLabel: z.string().max(200).optional(),
  requirementSector: z.string().max(120).nullable().optional(),
  requirementLocationText: z.string().max(400).nullable().optional(),
  requirementTenure: z.enum(['rent', 'buy', 'both']).nullable().optional(),
  requirementSizeMinSqft: z.number().nullable().optional(),
  requirementSizeMaxSqft: z.number().nullable().optional(),
  aiWhyFit: z.string().max(600).nullable().optional(),
});

export type CreateMatchInput = z.infer<typeof CreateMatchSchema>;
export type UpdateMatchInput = z.infer<typeof UpdateMatchSchema>;
