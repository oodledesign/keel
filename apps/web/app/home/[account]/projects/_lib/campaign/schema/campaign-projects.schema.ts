import { z } from 'zod';

import { PROJECT_FIELD_TYPES } from '~/lib/campaign-projects/types';

const accountId = z.string().uuid();
const projectId = z.string().uuid();
const clientId = z.string().uuid();
const fieldId = z.string().uuid();

const fieldOptionsSchema = z
  .object({
    choices: z.array(z.string().min(1)).optional(),
  })
  .optional()
  .default({});

export const ListCampaignProjectsSchema = z.object({
  accountId,
});

export const GetCampaignProjectSchema = z.object({
  accountId,
  projectId,
});

export const CreateCampaignProjectSchema = z.object({
  accountId,
  name: z.string().min(1, 'Name is required'),
  template: z.enum(['blank', 'website_revamp']).optional().default('blank'),
});

export const DeleteCampaignProjectSchema = z.object({
  accountId,
  projectId,
});

export type DeleteCampaignProjectInput = z.infer<typeof DeleteCampaignProjectSchema>;

export const CreateProjectFieldSchema = z.object({
  accountId,
  projectId,
  label: z.string().min(1, 'Label is required'),
  fieldType: z.enum(PROJECT_FIELD_TYPES),
  fieldKey: z
    .string()
    .regex(/^[a-z][a-z0-9_]*$/, 'Key must be lowercase letters, numbers, underscores')
    .optional(),
  options: fieldOptionsSchema,
});

export const UpdateProjectFieldSchema = z.object({
  accountId,
  projectId,
  fieldId,
  label: z.string().min(1).optional(),
  options: fieldOptionsSchema.optional(),
});

export const DeleteProjectFieldSchema = z.object({
  accountId,
  projectId,
  fieldId,
});

export const ReorderProjectFieldsSchema = z.object({
  accountId,
  projectId,
  fieldIds: z.array(fieldId).min(1),
});

export const AddClientToCampaignSchema = z.object({
  accountId,
  projectId,
  clientId,
});

export const RemoveClientFromCampaignSchema = z.object({
  accountId,
  projectId,
  clientId,
});

export const UpdateClientFieldValueSchema = z.object({
  accountId,
  projectId,
  clientId,
  fieldId,
  value: z.union([z.string(), z.number(), z.boolean(), z.null()]),
});

export const ImportWebsiteRevampCampaignSchema = z.object({
  accountId,
});

export type ListCampaignProjectsInput = z.infer<typeof ListCampaignProjectsSchema>;
export type GetCampaignProjectInput = z.infer<typeof GetCampaignProjectSchema>;
export type CreateCampaignProjectInput = z.infer<typeof CreateCampaignProjectSchema>;
export type CreateProjectFieldInput = z.infer<typeof CreateProjectFieldSchema>;
export type UpdateProjectFieldInput = z.infer<typeof UpdateProjectFieldSchema>;
export type DeleteProjectFieldInput = z.infer<typeof DeleteProjectFieldSchema>;
export type ReorderProjectFieldsInput = z.infer<typeof ReorderProjectFieldsSchema>;
export type AddClientToCampaignInput = z.infer<typeof AddClientToCampaignSchema>;
export type RemoveClientFromCampaignInput = z.infer<
  typeof RemoveClientFromCampaignSchema
>;
export type UpdateClientFieldValueInput = z.infer<typeof UpdateClientFieldValueSchema>;
