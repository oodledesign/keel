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

export type CreateMatchInput = z.infer<typeof CreateMatchSchema>;
export type UpdateMatchInput = z.infer<typeof UpdateMatchSchema>;
