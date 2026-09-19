import { z } from 'zod';

import { MEMORY_KINDS } from '../memory-constants';

const IsoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const MemoryKindSchema = z.enum(MEMORY_KINDS);

export const SaveFamilyMemorySchema = z.object({
  accountId: z.string().uuid(),
  accountSlug: z.string().min(1),
  noteId: z.string().uuid().optional(),
  title: z.string().max(500).optional(),
  content: z.string().trim().min(1, 'Write the memory').max(20_000),
  occurredAt: IsoDateSchema,
  kind: MemoryKindSchema.nullable().optional(),
  childIds: z.array(z.string().uuid()).max(20).default([]),
});

export type SaveFamilyMemoryInput = z.infer<typeof SaveFamilyMemorySchema>;

export const UpsertFamilyChildSchema = z.object({
  accountSlug: z.string().min(1),
  id: z.string().uuid().optional(),
  displayName: z.string().trim().min(1).max(80),
  dateOfBirth: IsoDateSchema.nullable().optional(),
  isChild: z.boolean().optional().default(true),
});

export type UpsertFamilyChildInput = z.infer<typeof UpsertFamilyChildSchema>;

export const FamilyMemoryMediaKindSchema = z.enum(['image', 'video', 'audio']);

export const FamilyMemoryMediaItemSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  mimeType: z.string().nullable(),
  url: z.string().nullable(),
  kind: FamilyMemoryMediaKindSchema.nullable(),
});

export type FamilyMemoryMediaItem = z.infer<typeof FamilyMemoryMediaItemSchema>;

export const PrepareFamilyMemoryMediaSchema = z.object({
  accountId: z.string().uuid(),
  accountSlug: z.string().min(1),
  noteId: z.string().uuid(),
  filename: z.string().min(1).max(500),
  mimeType: z.string().max(200).nullable().optional(),
  fileSizeBytes: z.number().int().nonnegative(),
});

export type PrepareFamilyMemoryMediaInput = z.infer<
  typeof PrepareFamilyMemoryMediaSchema
>;

export const CompleteFamilyMemoryMediaSchema = z.object({
  accountId: z.string().uuid(),
  accountSlug: z.string().min(1),
  noteId: z.string().uuid(),
  filePath: z.string().min(1).max(1000),
  filename: z.string().min(1).max(500),
  mimeType: z.string().max(200).nullable().optional(),
  title: z.string().max(500).optional(),
  fileSizeBytes: z.number().int().nonnegative(),
});

export type CompleteFamilyMemoryMediaInput = z.infer<
  typeof CompleteFamilyMemoryMediaSchema
>;
