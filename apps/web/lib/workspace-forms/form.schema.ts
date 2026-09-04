import { z } from 'zod';

import {
  WORKSPACE_FORM_DESTINATIONS,
  WORKSPACE_FORM_FIELD_TYPES,
  WORKSPACE_FORM_STATUSES,
} from './form-fields';
import { WORKSPACE_FORM_TEMPLATES } from './form-templates';
import { WORKSPACE_FORM_PAGE_BACKGROUNDS } from './form-theme';

export const WorkspaceFormFieldSchema = z.object({
  id: z.string().min(1).max(80),
  type: z.enum(WORKSPACE_FORM_FIELD_TYPES),
  key: z
    .string()
    .min(1)
    .max(60)
    .regex(/^[a-z][a-z0-9_]*$/),
  label: z.string().min(1).max(120),
  required: z.boolean(),
  placeholder: z.string().max(160).optional(),
  helpText: z.string().max(240).optional(),
  options: z.array(z.string().min(1).max(80)).max(40).optional(),
});

export const CreateWorkspaceFormSchema = z.object({
  accountId: z.string().uuid(),
  name: z.string().min(1).max(120),
  destination: z.enum(WORKSPACE_FORM_DESTINATIONS),
  template: z.enum(WORKSPACE_FORM_TEMPLATES).default('contact'),
});

export const WorkspaceFormThemeSchema = z.object({
  pageBackground: z.enum(WORKSPACE_FORM_PAGE_BACKGROUNDS),
});

export const UpdateWorkspaceFormSchema = z.object({
  accountId: z.string().uuid(),
  formId: z.string().uuid(),
  name: z.string().min(1).max(120),
  description: z.string().max(500).optional().nullable(),
  destination: z.enum(WORKSPACE_FORM_DESTINATIONS),
  listingId: z.string().uuid().optional().nullable(),
  status: z.enum(WORKSPACE_FORM_STATUSES).optional(),
  enabled: z.boolean().optional(),
  submitLabel: z.string().min(1).max(60).optional(),
  successMessage: z.string().max(400).optional().nullable(),
  fields: z.array(WorkspaceFormFieldSchema).min(1).max(40),
  theme: WorkspaceFormThemeSchema.optional(),
});

export const DeleteWorkspaceFormSchema = z.object({
  accountId: z.string().uuid(),
  formId: z.string().uuid(),
});

export const PublishWorkspaceFormSchema = z.object({
  accountId: z.string().uuid(),
  formId: z.string().uuid(),
  enabled: z.boolean(),
});

export const PublicWorkspaceFormSubmitSchema = z.object({
  token: z.string().min(16).max(128),
  values: z
    .record(z.string().max(80), z.union([z.string().max(2000), z.boolean()]))
    .default({}),
  listingId: z.string().uuid().optional().nullable(),
  propertyId: z.string().uuid().optional().nullable(),
  /** Honeypot — bots fill this; humans leave empty. */
  website: z.string().max(200).optional().or(z.literal('')),
});

export type CreateWorkspaceFormInput = z.infer<
  typeof CreateWorkspaceFormSchema
>;
export type UpdateWorkspaceFormInput = z.infer<
  typeof UpdateWorkspaceFormSchema
>;
export type DeleteWorkspaceFormInput = z.infer<
  typeof DeleteWorkspaceFormSchema
>;
export type PublishWorkspaceFormInput = z.infer<
  typeof PublishWorkspaceFormSchema
>;
export type PublicWorkspaceFormSubmitInput = z.infer<
  typeof PublicWorkspaceFormSubmitSchema
>;
