import { z } from 'zod';

const project = {
  accountId: z.string().uuid(),
  accountSlug: z.string().min(1),
  jobId: z.string().uuid(),
};

const role = z
  .string()
  .trim()
  .max(120)
  .transform((value) => value || null)
  .nullable();

const description = z
  .string()
  .trim()
  .max(1000)
  .transform((value) => value || null)
  .nullable();

export const AddProjectMemberSchema = z.object({
  ...project,
  userId: z.string().uuid(),
  role: role.optional(),
  description: description.optional(),
});

export const UpdateProjectMemberSchema = z.object({
  ...project,
  userId: z.string().uuid(),
  role,
  description,
});

export const RemoveProjectMemberSchema = z.object({
  ...project,
  userId: z.string().uuid(),
});

export const AddProjectContactSchema = z.object({
  ...project,
  contactId: z.string().uuid(),
  role: role.optional(),
  description: description.optional(),
});

export const CreateProjectContactSchema = z.object({
  ...project,
  name: z.string().trim().min(1).max(200),
  email: z
    .string()
    .trim()
    .max(320)
    .email()
    .or(z.literal(''))
    .transform((value) => value || null)
    .nullable()
    .optional(),
  companyName: z
    .string()
    .trim()
    .max(200)
    .transform((value) => value || null)
    .nullable()
    .optional(),
  /** Also add them to the project's client in the CRM. */
  linkToClient: z.boolean().default(false),
  role: role.optional(),
  description: description.optional(),
});

export const UpdateProjectContactSchema = z.object({
  ...project,
  contactId: z.string().uuid(),
  role,
  description,
});

export const RemoveProjectContactSchema = z.object({
  ...project,
  contactId: z.string().uuid(),
});

export const SearchProjectContactsSchema = z.object({
  accountId: z.string().uuid(),
  jobId: z.string().uuid(),
  query: z.string().trim().max(100).default(''),
});

export type AddProjectMemberInput = z.infer<typeof AddProjectMemberSchema>;
export type UpdateProjectMemberInput = z.infer<
  typeof UpdateProjectMemberSchema
>;
export type RemoveProjectMemberInput = z.infer<
  typeof RemoveProjectMemberSchema
>;
export type AddProjectContactInput = z.infer<typeof AddProjectContactSchema>;
export type CreateProjectContactInput = z.infer<
  typeof CreateProjectContactSchema
>;
export type UpdateProjectContactInput = z.infer<
  typeof UpdateProjectContactSchema
>;
export type RemoveProjectContactInput = z.infer<
  typeof RemoveProjectContactSchema
>;
export type SearchProjectContactsInput = z.infer<
  typeof SearchProjectContactsSchema
>;

export type ProjectContactCandidate = {
  id: string;
  name: string;
  email: string | null;
  companyName: string | null;
  pictureUrl: string | null;
  isClientContact: boolean;
};
