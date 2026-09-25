import { z } from 'zod';

import {
  COMPETITOR_CATEGORIES,
  COMPETITOR_STATUSES,
  COMPETITOR_TENURES,
} from '~/lib/commercial/competitor-tracker/constants';

export const ListTrackerSchema = z.object({
  accountId: z.string().uuid(),
  category: z.enum(COMPETITOR_CATEGORIES).optional().nullable(),
  status: z.enum(COMPETITOR_STATUSES).optional().nullable(),
  query: z.string().max(200).optional().nullable(),
});

export const CreateTrackerListingSchema = z.object({
  accountId: z.string().uuid(),
  name: z.string().min(1).max(300),
  locationText: z.string().max(500).optional().nullable(),
  town: z.string().max(120).optional().nullable(),
  postcode: z.string().max(20).optional().nullable(),
  sizeSqft: z.number().nonnegative().optional().nullable(),
  sizeMinSqft: z.number().nonnegative().optional().nullable(),
  sizeMaxSqft: z.number().nonnegative().optional().nullable(),
  pricePence: z.number().int().optional().nullable(),
  tenure: z.enum(COMPETITOR_TENURES).optional().nullable(),
  competitorAgent: z.string().max(200).optional().nullable(),
  category: z.enum(COMPETITOR_CATEGORIES).default('industrial'),
  status: z.enum(COMPETITOR_STATUSES).default('watching'),
  sourceUrl: z.string().max(2000).optional().nullable(),
  notes: z.string().max(5000).optional().nullable(),
});

export const UpdateTrackerListingSchema = CreateTrackerListingSchema.partial()
  .omit({ accountId: true })
  .extend({
    listingId: z.string().uuid(),
    accountId: z.string().uuid(),
  });

export const ArchiveTrackerListingSchema = z.object({
  listingId: z.string().uuid(),
  accountId: z.string().uuid(),
});

export const ImportTrackerCsvSchema = z.object({
  accountId: z.string().uuid(),
  csvText: z.string().min(1).max(2_000_000),
});

export const EnrichTrackerUrlSchema = z.object({
  accountId: z.string().uuid(),
  url: z.string().url().max(2000),
});

export const SaveEnrichedTrackerListingSchema =
  CreateTrackerListingSchema.extend({
    enrichmentConfidence: z
      .enum(['high', 'medium', 'low'])
      .optional()
      .nullable(),
  });

export const CreateTrackerWatchSchema = z.object({
  accountId: z.string().uuid(),
  name: z.string().min(1).max(200),
  towns: z.array(z.string().max(120)).max(40).default([]),
  postcodePrefixes: z.array(z.string().max(12)).max(40).default([]),
  categories: z
    .array(z.enum(COMPETITOR_CATEGORIES))
    .min(1)
    .default(['industrial', 'retail', 'development']),
  sizeMinSqft: z.number().nonnegative().optional().nullable(),
  sizeMaxSqft: z.number().nonnegative().optional().nullable(),
  notifyOnNew: z.boolean().default(true),
  notifyOnPriceChange: z.boolean().default(true),
  enabled: z.boolean().default(true),
});

export const UpdateTrackerWatchSchema = CreateTrackerWatchSchema.partial()
  .omit({ accountId: true })
  .extend({
    watchId: z.string().uuid(),
    accountId: z.string().uuid(),
  });

export const DeleteTrackerWatchSchema = z.object({
  watchId: z.string().uuid(),
  accountId: z.string().uuid(),
});

export const MarkTrackerNotificationsReadSchema = z.object({
  accountId: z.string().uuid(),
  notificationIds: z.array(z.string().uuid()).optional(),
});

export const RunTrackerWatchesSchema = z.object({
  accountId: z.string().uuid(),
  sinceHours: z.number().int().min(1).max(168).optional(),
});
