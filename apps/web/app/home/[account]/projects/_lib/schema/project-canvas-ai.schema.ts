import { z } from 'zod';

import type { CanvasAiRequest } from '~/lib/projects/canvas/canvas-ai';
import { CONTENT_PLATFORM_KEYS } from '~/lib/projects/content/content-calendar';

const ymd = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

const CanvasAiItemSchema = z.object({
  kind: z.string().max(20),
  text: z.string().trim().min(1).max(4000),
});

const SectionAreaSchema = z.object({
  key: z.string().min(1).max(80),
  title: z.string().trim().max(200),
  existing: z.array(z.string().max(1000)).max(30).default([]),
});

export const CanvasAiRequestSchema: z.ZodType<
  CanvasAiRequest,
  z.ZodTypeDef,
  unknown
> = z.discriminatedUnion('mode', [
  z.object({
    mode: z.literal('summarise'),
    items: z.array(CanvasAiItemSchema).min(1).max(80),
  }),
  z.object({
    mode: z.literal('tasks'),
    items: z.array(CanvasAiItemSchema).min(1).max(80),
  }),
  z.object({
    mode: z.literal('brainstorm'),
    prompt: z.string().trim().min(3).max(500),
    items: z.array(CanvasAiItemSchema).max(40).default([]),
  }),
  z.object({
    mode: z.literal('fill_areas'),
    sectionTitle: z.string().trim().max(200),
    instructions: z.string().trim().max(500).optional(),
    areas: z.array(SectionAreaSchema).min(1).max(12),
  }),
  z.object({
    mode: z.literal('content_posts'),
    prompt: z.string().trim().min(3).max(500),
    startDate: ymd,
    endDate: ymd,
    platforms: z.array(z.enum(CONTENT_PLATFORM_KEYS)).min(1).max(12),
  }),
  z.object({
    mode: z.literal('fill_calendar'),
    sectionTitle: z.string().trim().max(200),
    instructions: z.string().trim().max(500).optional(),
    rows: z.array(SectionAreaSchema).min(1).max(10),
    weeks: z
      .array(
        z.object({ key: z.string().min(1).max(80), label: z.string().max(60) }),
      )
      .min(1)
      .max(8),
  }),
]);

export const CanvasAiAssistSchema = z.object({
  accountId: z.string().uuid(),
  jobId: z.string().uuid(),
  request: CanvasAiRequestSchema,
});

export type CanvasAiAssistInput = z.infer<typeof CanvasAiAssistSchema>;
