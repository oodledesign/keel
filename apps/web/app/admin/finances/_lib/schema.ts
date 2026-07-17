import { z } from 'zod';

export const OPERATING_COST_CATEGORIES = [
  'vercel',
  'supabase',
  'domain',
  'email',
  'monitoring',
  'ai_provider',
  'other',
] as const;

export const UpsertOperatingCostSchema = z.object({
  id: z.string().uuid().optional().nullable(),
  category: z.enum(OPERATING_COST_CATEGORIES),
  label: z.string().trim().min(1).max(120),
  amountMajor: z.coerce.number().min(0).max(1_000_000),
  currency: z.string().trim().min(3).max(3).default('gbp'),
  periodMonth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-01'),
  notes: z.string().trim().max(500).optional().nullable(),
});

export const DeleteOperatingCostSchema = z.object({
  id: z.string().uuid(),
});

export const UpsertModelRateSchema = z.object({
  model: z.string().trim().min(1).max(120),
  provider: z.enum(['anthropic', 'google', 'other']),
  inputUsdPerMtok: z.coerce.number().min(0).max(10_000),
  outputUsdPerMtok: z.coerce.number().min(0).max(10_000),
  notes: z.string().trim().max(500).optional().nullable(),
});
