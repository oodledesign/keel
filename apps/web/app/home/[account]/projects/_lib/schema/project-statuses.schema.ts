import { z } from 'zod';

import { PROJECT_STATUS_CATEGORIES } from '~/lib/projects/project-statuses';

export const ProjectStatusSlugSchema = z
  .string()
  .trim()
  .min(1)
  .max(48)
  .regex(
    /^[a-z][a-z0-9_]{0,47}$/,
    'Status key must start with a letter and use lowercase letters, numbers, or underscores',
  );

export const ProjectStatusLabelSchema = z
  .string()
  .trim()
  .min(1, 'Label is required')
  .max(40, 'Keep labels to 40 characters');

export const ProjectStatusColorSchema = z
  .string()
  .trim()
  .regex(/^#[0-9A-Fa-f]{6}$/, 'Colour must be a hex value like #FF5C34');

export const ProjectStatusCategorySchema = z.enum(PROJECT_STATUS_CATEGORIES);

export const ListProjectStatusesSchema = z.object({
  accountId: z.string().uuid(),
});

const accountSlugSchema = z.string().trim().min(1).optional();

export const CreateProjectStatusSchema = z.object({
  accountId: z.string().uuid(),
  accountSlug: accountSlugSchema,
  label: ProjectStatusLabelSchema,
  color: ProjectStatusColorSchema.optional(),
  category: ProjectStatusCategorySchema.optional().default('open'),
  isDefault: z.boolean().optional(),
});

export const UpdateProjectStatusSchema = z.object({
  accountId: z.string().uuid(),
  accountSlug: accountSlugSchema,
  id: z.string().uuid(),
  label: ProjectStatusLabelSchema.optional(),
  color: ProjectStatusColorSchema.optional(),
  category: ProjectStatusCategorySchema.optional(),
  isDefault: z.boolean().optional(),
  slug: ProjectStatusSlugSchema.optional(),
});

export const ReorderProjectStatusesSchema = z.object({
  accountId: z.string().uuid(),
  accountSlug: accountSlugSchema,
  orderedIds: z.array(z.string().uuid()).min(1).max(40),
});

export const DeleteProjectStatusSchema = z.object({
  accountId: z.string().uuid(),
  accountSlug: accountSlugSchema,
  id: z.string().uuid(),
  remapToId: z.string().uuid().optional(),
});

export type ListProjectStatusesInput = z.infer<
  typeof ListProjectStatusesSchema
>;
export type CreateProjectStatusInput = z.infer<
  typeof CreateProjectStatusSchema
>;
export type UpdateProjectStatusInput = z.infer<
  typeof UpdateProjectStatusSchema
>;
export type ReorderProjectStatusesInput = z.infer<
  typeof ReorderProjectStatusesSchema
>;
export type DeleteProjectStatusInput = z.infer<
  typeof DeleteProjectStatusSchema
>;
