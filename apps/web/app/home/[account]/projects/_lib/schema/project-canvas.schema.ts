import { z } from 'zod';

import {
  CANVAS_COLOR_KEYS,
  CANVAS_ITEM_KINDS,
  CANVAS_SECTION_PRESETS,
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

const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
const CANVAS_IMAGE_PATH = new RegExp(
  `^${UUID}/${UUID}/${UUID}\\.(png|jpg|webp|gif)$`,
);

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
    path: z.string().regex(CANVAS_IMAGE_PATH).optional(),
    title: z.string().max(500).optional(),
    fontSize: z.number().int().min(8).max(200).optional(),
    bold: z.boolean().optional(),
    italic: z.boolean().optional(),
    preset: z.enum(CANVAS_SECTION_PRESETS).optional(),
    showTasks: z.boolean().optional(),
    description: z.string().max(1000).optional(),
    faviconUrl: httpUrl.optional(),
    imageUrl: httpUrl.optional(),
    linkId: z.string().uuid().optional(),
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

export const UpsertProjectCanvasItemsSchema = z
  .object({
    ...accountProject,
    items: z.array(CanvasItemInputSchema).min(1).max(300),
    /** Seeding: keep rows someone else already created. */
    ignoreExisting: z.boolean().optional(),
  })
  .superRefine((input, ctx) => {
    const prefix = `${input.accountId}/${input.jobId}/`;
    input.items.forEach((item, index) => {
      if (item.data.path && !item.data.path.startsWith(prefix)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Image belongs to a different project',
          path: ['items', index, 'data', 'path'],
        });
      }
    });
  });

export const DeleteProjectCanvasItemsSchema = z.object({
  ...accountProject,
  ids: z.array(z.string().uuid()).min(1).max(500),
});

export const LoadProjectCanvasNoteSchema = z.object({
  ...accountProject,
  noteId: z.string().uuid(),
});

export const UpdateProjectCanvasNoteSchema = z.object({
  ...accountProject,
  noteId: z.string().uuid(),
  title: z.string().max(500),
  content: z.string().max(200_000),
});

export const CreateProjectCanvasNoteSchema = z
  .object({
    ...accountProject,
    title: z.string().max(500),
    content: z.string().max(200_000),
  })
  .refine((note) => note.title.trim() || note.content.trim(), {
    message: 'Give the note a title or some content',
  });

export type CanvasItemInput = z.infer<typeof CanvasItemInputSchema>;
export type LoadProjectCanvasInput = z.infer<typeof LoadProjectCanvasSchema>;
export type UpsertProjectCanvasItemsInput = z.infer<
  typeof UpsertProjectCanvasItemsSchema
>;
export type DeleteProjectCanvasItemsInput = z.infer<
  typeof DeleteProjectCanvasItemsSchema
>;
export type LoadProjectCanvasNoteInput = z.infer<
  typeof LoadProjectCanvasNoteSchema
>;
export type UpdateProjectCanvasNoteInput = z.infer<
  typeof UpdateProjectCanvasNoteSchema
>;
export type CreateProjectCanvasNoteInput = z.infer<
  typeof CreateProjectCanvasNoteSchema
>;

export type ProjectCanvasNote = {
  id: string;
  title: string | null;
  /** Markdown, capped for display; load the note to edit the full text. */
  content: string;
  truncated: boolean;
  phaseId: string | null;
  isPinned: boolean;
  updatedAt: string | null;
};

/** Project-specific details for a team member (people data comes from the board). */
export type ProjectCanvasMember = {
  userId: string;
  role: string | null;
  description: string | null;
};

/** Name and avatar for comment authors and task assignees, including guests. */
export type ProjectCanvasPerson = {
  id: string;
  name: string | null;
  pictureUrl: string | null;
};

/** A contact (client contact, consultant, supplier…) on this project. */
export type ProjectCanvasContact = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  pictureUrl: string | null;
  companyName: string | null;
  role: string | null;
  description: string | null;
  isClientContact: boolean;
};

export type ProjectCanvasComment = {
  id: string;
  itemId: string;
  body: string;
  mentions: string[];
  authorId: string;
  resolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ProjectCanvasDoc = {
  id: string;
  title: string;
  kind: 'written' | 'uploaded';
  mimeType: string | null;
  sizeBytes: number | null;
  docType: string | null;
  updatedAt: string | null;
};
