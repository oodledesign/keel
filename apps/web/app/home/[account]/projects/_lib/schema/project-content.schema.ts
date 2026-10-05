import { z } from 'zod';

import {
  CONTENT_PLATFORM_KEYS,
  CONTENT_STATUS_KEYS,
} from '~/lib/projects/content/content-calendar';

const ymd = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD');

const accountProject = {
  accountId: z.string().uuid(),
  jobId: z.string().uuid(),
};

export const LoadProjectContentSchema = z.object(accountProject);

export const ContentPostInputSchema = z.object({
  id: z.string().uuid().optional(),
  postDate: ymd,
  postTime: z
    .string()
    .regex(/^\d{2}:\d{2}$/, 'Use HH:mm')
    .nullable()
    .optional(),
  title: z.string().trim().min(1, 'Add a title').max(300),
  body: z.string().max(20_000).optional(),
  status: z.enum(CONTENT_STATUS_KEYS).optional(),
  platforms: z.array(z.enum(CONTENT_PLATFORM_KEYS)).max(12).optional(),
  linkUrl: z
    .string()
    .trim()
    .max(2000)
    .refine((value) => value === '' || /^https?:\/\//i.test(value), {
      message: 'Links must start with http:// or https://',
    })
    .nullable()
    .optional(),
});

export const SaveContentPostSchema = z.object({
  ...accountProject,
  post: ContentPostInputSchema,
});

export const DeleteContentPostSchema = z.object({
  ...accountProject,
  id: z.string().uuid(),
});

export const SavePeriodNoteSchema = z.object({
  ...accountProject,
  kind: z.enum(['week', 'month']),
  periodStart: ymd,
  body: z.string().max(5000),
});
