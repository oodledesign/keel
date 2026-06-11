import { z } from 'zod';

export const RELATIONSHIP_PRESETS = [
  'Family',
  'Friend',
  'Partner',
  'Colleague',
  'Neighbour',
  'Other',
] as const;

export const PERSON_CIRCLE_TIERS = [
  'core',
  'close',
  'friends',
  'community',
] as const;

export type PersonCircleTier = (typeof PERSON_CIRCLE_TIERS)[number];

export const DEFAULT_PERSON_CIRCLE_TIER: PersonCircleTier = 'friends';

export const CATCHUP_CADENCE_OPTIONS = [
  { label: 'Off', value: null },
  { label: 'Weekly', value: 7 },
  { label: 'Fortnightly', value: 14 },
  { label: 'Monthly', value: 30 },
  { label: 'Quarterly', value: 90 },
  { label: 'Every 6 months', value: 180 },
  { label: 'Yearly', value: 365 },
] as const;

export const DATE_KINDS = ['birthday', 'anniversary', 'custom'] as const;

export const CreatePersonSchema = z.object({
  fullName: z.string().trim().min(1, 'Name is required').max(200),
  nickname: z.string().trim().max(100).optional().nullable(),
  relationshipLabel: z.string().trim().max(100).optional().nullable(),
  email: z
    .string()
    .trim()
    .optional()
    .nullable()
    .refine((v) => !v || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), {
      message: 'Invalid email',
    }),
  phone: z.string().trim().max(50).optional().nullable(),
  generalNotes: z.string().trim().max(5000).optional().nullable(),
  catchupCadenceDays: z.number().int().positive().optional().nullable(),
  circleTier: z.enum(PERSON_CIRCLE_TIERS).optional(),
});

export const UpdatePersonSchema = CreatePersonSchema.extend({
  id: z.string().uuid(),
});

export const DeletePersonSchema = z.object({
  id: z.string().uuid(),
});

export const CreatePersonDateSchema = z.object({
  personId: z.string().uuid(),
  kind: z.enum(DATE_KINDS),
  month: z.number().int().min(1).max(12),
  day: z.number().int().min(1).max(31),
  yearOptional: z.number().int().min(1900).max(2100).optional().nullable(),
  label: z.string().trim().max(200).optional().nullable(),
  notes: z.string().trim().max(2000).optional().nullable(),
});

export const UpdatePersonDateSchema = CreatePersonDateSchema.extend({
  id: z.string().uuid(),
});

export const DeletePersonDateSchema = z.object({
  id: z.string().uuid(),
  personId: z.string().uuid(),
});

export const CreateGiftIdeaSchema = z.object({
  personId: z.string().uuid(),
  title: z.string().trim().min(1, 'Title is required').max(300),
  notes: z.string().trim().max(2000).optional().nullable(),
  url: z
    .string()
    .trim()
    .optional()
    .nullable()
    .refine((v) => !v || /^https?:\/\/.+/i.test(v), { message: 'Invalid URL' }),
  occasion: z.string().trim().max(200).optional().nullable(),
});

export const UpdateGiftIdeaSchema = CreateGiftIdeaSchema.extend({
  id: z.string().uuid(),
  purchased: z.boolean().optional(),
});

export const DeleteGiftIdeaSchema = z.object({
  id: z.string().uuid(),
  personId: z.string().uuid(),
});

export const CreateCatchupSchema = z.object({
  personId: z.string().uuid(),
  metOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  location: z.string().trim().max(300).optional().nullable(),
  conversationNotes: z.string().trim().max(10000).optional().nullable(),
});

export const UpdateCatchupSchema = CreateCatchupSchema.extend({
  id: z.string().uuid(),
});

export const DeleteCatchupSchema = z.object({
  id: z.string().uuid(),
  personId: z.string().uuid(),
});

export const CreatePersonNoteSchema = z.object({
  personId: z.string().uuid(),
  body: z.string().trim().min(1, 'Note cannot be empty').max(10000),
});

export const UpdatePersonNoteSchema = CreatePersonNoteSchema.extend({
  id: z.string().uuid(),
});

export const DeletePersonNoteSchema = z.object({
  id: z.string().uuid(),
  personId: z.string().uuid(),
});

export type PersonRow = {
  id: string;
  account_id: string;
  user_id: string;
  full_name: string;
  nickname: string | null;
  relationship_label: string | null;
  email: string | null;
  phone: string | null;
  avatar_url: string | null;
  general_notes: string | null;
  catchup_cadence_days: number | null;
  last_catchup_on: string | null;
  circle_tier: PersonCircleTier;
  created_at: string;
  updated_at: string;
};

export type PersonDateRow = {
  id: string;
  person_id: string;
  kind: (typeof DATE_KINDS)[number];
  month: number;
  day: number;
  year_optional: number | null;
  label: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type GiftIdeaRow = {
  id: string;
  person_id: string;
  title: string;
  notes: string | null;
  url: string | null;
  occasion: string | null;
  purchased: boolean;
  created_at: string;
  updated_at: string;
};

export type CatchupRow = {
  id: string;
  person_id: string;
  met_on: string;
  location: string | null;
  conversation_notes: string | null;
  created_at: string;
  updated_at: string;
};

export type PersonNoteRow = {
  id: string;
  person_id: string;
  body: string;
  created_at: string;
  updated_at: string;
};
