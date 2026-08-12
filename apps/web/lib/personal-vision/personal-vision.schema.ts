import { z } from 'zod';

export const VisionGoalHorizonSchema = z.enum([
  '1_month',
  '6_months',
  '12_months',
  '5_years',
  '20_years',
]);

export type VisionGoalHorizon = z.infer<typeof VisionGoalHorizonSchema>;

export const VisionWealthGoalSchema = z.object({
  id: z.string().min(1).max(64).optional(),
  label: z.string().max(500),
  target_pence: z.number().int().nonnegative().nullable().optional(),
});

export const VisionGoalHorizonBlockSchema = z.object({
  horizon: VisionGoalHorizonSchema,
  title: z.string().max(200).optional().default(''),
  wealth_goals: z.array(VisionWealthGoalSchema).default([]),
  other_goals: z.array(z.string().max(500)).default([]),
  standards: z.array(z.string().max(500)).default([]),
});

export const VisionStoryItemSchema = z.object({
  id: z.string().min(1).max(64).optional(),
  label: z.string().max(200),
  detail: z.string().max(1000).optional().default(''),
});

export const VisionLegacySchema = z.object({
  headline: z.string().max(300).optional().default(''),
  body: z.string().max(5000).optional().default(''),
  wins: z.array(z.string().max(500)).default([]),
});

export const VisionCharacterSchema = z.object({
  traits: z.array(z.string().max(500)).default([]),
  style: z.array(z.string().max(500)).default([]),
  achievements: z.array(z.string().max(500)).default([]),
  mentors: z.array(z.string().max(200)).default([]),
  branding: z.string().max(2000).optional().default(''),
});

export const PersonalVisionContentSchema = z.object({
  foundations: z.array(z.string().max(2000)).default([]),
  principles: z.array(z.string().max(2000)).default([]),
  daily_ritual: z.array(z.string().max(2000)).default([]),
  long_term_mindset: z.array(z.string().max(2000)).default([]),
  identity_snapshot: z.string().max(500).optional().default(''),
  legacy_to_date: VisionLegacySchema.default({
    headline: '',
    body: '',
    wins: [],
  }),
  story: z
    .object({
      items: z.array(VisionStoryItemSchema).default([]),
    })
    .default({ items: [] }),
  manifesto: z.string().max(20000).optional().default(''),
  character: VisionCharacterSchema.default({
    traits: [],
    style: [],
    achievements: [],
    mentors: [],
    branding: '',
  }),
  goals: z.array(VisionGoalHorizonBlockSchema).default([]),
  affirmations: z.array(z.string().max(2000)).default([]),
});

export type PersonalVisionContent = z.infer<typeof PersonalVisionContentSchema>;

export const SavePersonalVisionSchema = z.object({
  content: PersonalVisionContentSchema,
  financeAccountIds: z.array(z.string().uuid()).max(50).default([]),
  dashboardEnabled: z.boolean(),
});

export type SavePersonalVisionInput = z.infer<typeof SavePersonalVisionSchema>;

export const EMPTY_PERSONAL_VISION_CONTENT: PersonalVisionContent =
  PersonalVisionContentSchema.parse({});

export const VISION_GOAL_HORIZON_ORDER: VisionGoalHorizon[] = [
  '1_month',
  '6_months',
  '12_months',
  '5_years',
  '20_years',
];

export const VISION_GOAL_HORIZON_LABELS: Record<VisionGoalHorizon, string> = {
  '1_month': '1 month',
  '6_months': '6 months',
  '12_months': '12 months',
  '5_years': '5 years',
  '20_years': '20 years',
};

export function ensureGoalHorizons(
  goals: PersonalVisionContent['goals'],
): PersonalVisionContent['goals'] {
  const byHorizon = new Map(goals.map((g) => [g.horizon, g]));
  return VISION_GOAL_HORIZON_ORDER.map((horizon) => {
    const existing = byHorizon.get(horizon);
    if (existing) return existing;
    return {
      horizon,
      title: '',
      wealth_goals: [],
      other_goals: [],
      standards: [],
    };
  });
}
