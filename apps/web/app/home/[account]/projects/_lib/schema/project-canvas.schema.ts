import { z } from 'zod';

import {
  CANVAS_COLOR_KEYS,
  CANVAS_ITEM_KINDS,
  CANVAS_SHAPE_TYPES,
  type CanvasColorKey,
  type CanvasShapeType,
  isLinkedCanvasKind,
} from '~/lib/projects/canvas/canvas-types';

const coordinate = z.number().finite().min(-1_000_000).max(1_000_000);
const dimension = z.number().finite().positive().max(20_000).nullable();

const httpUrl = z
  .string()
  .trim()
  .max(2000)
  .refine((value) => /^https?:\/\//i.test(value), 'Use an http(s) link');

export const CanvasItemDataSchema = z
  .object({
    text: z.string().max(10_000).optional(),
    color: z
      .enum(CANVAS_COLOR_KEYS as [CanvasColorKey, ...CanvasColorKey[]])
      .optional(),
    shape: z
      .enum(CANVAS_SHAPE_TYPES as [CanvasShapeType, ...CanvasShapeType[]])
      .optional(),
    points: z
      .array(z.tuple([z.number().finite(), z.number().finite()]))
      .max(4000)
      .optional(),
    strokeWidth: z.number().min(1).max(40).optional(),
    url: httpUrl.optional(),
    title: z.string().max(500).optional(),
    source: z.string().uuid().optional(),
    target: z.string().uuid().optional(),
    sourceHandle: z.string().max(40).nullable().optional(),
    targetHandle: z.string().max(40).nullable().optional(),
    label: z.string().max(500).optional(),
  })
  .strict();

export const CanvasItemInputSchema = z
  .object({
    id: z.string().uuid(),
    kind: z.enum(CANVAS_ITEM_KINDS),
    refId: z.string().uuid().nullable(),
    x: coordinate,
    y: coordinate,
    w: dimension,
    h: dimension,
    zIndex: z.number().int().min(-100_000).max(100_000),
    data: CanvasItemDataSchema,
  })
  .superRefine((item, ctx) => {
    if (isLinkedCanvasKind(item.kind) !== (item.refId !== null)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          'Linked canvas items need a reference; freeform items must not',
        path: ['refId'],
      });
    }
    if (item.kind === 'connector' && (!item.data.source || !item.data.target)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Connectors need a source and target',
        path: ['data'],
      });
    }
  });

const accountProject = {
  accountId: z.string().uuid(),
  jobId: z.string().uuid(),
};

export const LoadProjectCanvasSchema = z.object(accountProject);

export const UpsertProjectCanvasItemsSchema = z.object({
  ...accountProject,
  items: z.array(CanvasItemInputSchema).min(1).max(300),
  /** Seeding: keep rows someone else already created. */
  ignoreExisting: z.boolean().optional(),
});

export const DeleteProjectCanvasItemsSchema = z.object({
  ...accountProject,
  ids: z.array(z.string().uuid()).min(1).max(500),
});

export type CanvasItemInput = z.infer<typeof CanvasItemInputSchema>;
export type LoadProjectCanvasInput = z.infer<typeof LoadProjectCanvasSchema>;
export type UpsertProjectCanvasItemsInput = z.infer<
  typeof UpsertProjectCanvasItemsSchema
>;
export type DeleteProjectCanvasItemsInput = z.infer<
  typeof DeleteProjectCanvasItemsSchema
>;

export type ProjectCanvasNote = {
  id: string;
  title: string | null;
  preview: string;
  phaseId: string | null;
  isPinned: boolean;
  updatedAt: string | null;
};
