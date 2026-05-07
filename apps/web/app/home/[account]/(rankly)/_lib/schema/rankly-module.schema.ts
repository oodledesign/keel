import { z } from 'zod';

export const createRanklyProjectActionSchema = z.object({
  accountId: z.string().uuid(),
  name: z.string().min(1).max(200),
  domain: z.string().min(1).max(255),
  colour: z.string().max(32).optional().nullable(),
  notes: z.string().max(5000).optional().nullable(),
  target_country: z.string().min(2).max(8).default('US'),
  target_language: z.string().min(2).max(16).default('en'),
  track_desktop: z.boolean().optional().default(true),
  track_mobile: z.boolean().optional().default(true),
});

export const deleteRanklyProjectActionSchema = z.object({
  accountId: z.string().uuid(),
  projectId: z.string().uuid(),
});

export const addRanklyKeywordActionSchema = z.object({
  accountId: z.string().uuid(),
  projectId: z.string().uuid(),
  keyword: z.string().min(1).max(500),
  search_engine: z.string().min(1).max(32).default('google'),
  device: z.string().min(1).max(16).default('desktop'),
});

export const deleteRanklyKeywordActionSchema = z.object({
  accountId: z.string().uuid(),
  keywordId: z.string().uuid(),
});
