import { z } from 'zod';

import {
  WORKSPACE_FORM_DESTINATIONS,
  WORKSPACE_FORM_FIELD_TYPES,
  WORKSPACE_FORM_STATUSES,
} from './form-fields';
import { WORKSPACE_FORM_UPLOAD_MAX_BYTES } from './form-file';
import { WORKSPACE_FORM_LOGIC_OPS } from './form-logic';
import { WORKSPACE_FORM_TEMPLATES } from './form-templates';
import {
  WORKSPACE_FORM_LAYOUTS,
  WORKSPACE_FORM_PAGE_BACKGROUNDS,
  WORKSPACE_FORM_PRESENTATIONS,
} from './form-theme';

const WorkspaceFormLogicConditionSchema = z.object({
  fieldKey: z
    .string()
    .min(1)
    .max(60)
    .regex(/^[a-z][a-z0-9_]*$/),
  op: z.enum(WORKSPACE_FORM_LOGIC_OPS),
  value: z.string().max(80).optional(),
});

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
  stepBreakAfter: z.boolean().optional(),
  visibleWhen: WorkspaceFormLogicConditionSchema.optional(),
  jumpRules: z
    .array(
      z.object({
        id: z.string().min(1).max(80),
        op: z.enum(WORKSPACE_FORM_LOGIC_OPS),
        value: z.string().max(80).optional(),
        targetKey: z
          .string()
          .min(1)
          .max(60)
          .regex(/^(_submit|[a-z][a-z0-9_]*)$/),
      }),
    )
    .max(10)
    .optional(),
});

export const CreateWorkspaceFormSchema = z.object({
  accountId: z.string().uuid(),
  name: z.string().min(1).max(120),
  destination: z.enum(WORKSPACE_FORM_DESTINATIONS),
  template: z.enum(WORKSPACE_FORM_TEMPLATES).default('contact'),
});

export const WorkspaceFormThemeSchema = z.object({
  pageBackground: z.enum(WORKSPACE_FORM_PAGE_BACKGROUNDS),
  layout: z.enum(WORKSPACE_FORM_LAYOUTS).optional(),
  layoutExplicit: z.boolean().optional(),
  presentation: z.enum(WORKSPACE_FORM_PRESENTATIONS).optional(),
});

export const WorkspaceFormEmailTemplateSchema = z.object({
  id: z.string().min(1).max(80),
  name: z.string().min(1).max(80),
  subject: z.string().min(1).max(180),
  bodyHtml: z.string().max(8000),
});

export const WorkspaceFormEmailRuleSchema = z.object({
  id: z.string().min(1).max(80),
  kind: z.enum(['autoresponder', 'notification']),
  enabled: z.boolean(),
  fieldKey: z.string().max(60).nullable(),
  equals: z.string().max(80).nullable(),
  templateId: z.string().min(1).max(80),
  sortOrder: z.number().int().min(0).max(40),
});

export const WorkspaceFormEmailSettingsSchema = z.object({
  templates: z.array(WorkspaceFormEmailTemplateSchema).max(20),
  rules: z.array(WorkspaceFormEmailRuleSchema).max(40),
  notifyMemberIds: z.array(z.string().uuid()).max(40),
  notifyEmails: z.array(z.string().max(160)).max(10),
  includeSubmittedAnswers: z.boolean().optional().default(true),
});

export const UpdateWorkspaceFormSchema = z.object({
  accountId: z.string().uuid(),
  formId: z.string().uuid(),
  name: z.string().min(1).max(120),
  description: z.string().max(8000).optional().nullable(),
  eventAddress: z.string().max(240).optional().nullable(),
  eventDate: z.string().max(120).optional().nullable(),
  eventTime: z.string().max(120).optional().nullable(),
  destination: z.enum(WORKSPACE_FORM_DESTINATIONS),
  listingId: z.string().uuid().optional().nullable(),
  status: z.enum(WORKSPACE_FORM_STATUSES).optional(),
  enabled: z.boolean().optional(),
  submitLabel: z.string().min(1).max(60).optional(),
  successMessage: z.string().max(400).optional().nullable(),
  fields: z.array(WorkspaceFormFieldSchema).min(1).max(40),
  theme: WorkspaceFormThemeSchema.optional(),
  emailSettings: WorkspaceFormEmailSettingsSchema.optional(),
});

export const DeleteWorkspaceFormSchema = z.object({
  accountId: z.string().uuid(),
  formId: z.string().uuid(),
});

export const DeleteWorkspaceFormSubmissionSchema = z.object({
  accountId: z.string().uuid(),
  accountSlug: z.string().min(1),
  formId: z.string().uuid(),
  submissionId: z.string().uuid(),
  campaignId: z.string().uuid().optional(),
});

export const PublishWorkspaceFormSchema = z.object({
  accountId: z.string().uuid(),
  formId: z.string().uuid(),
  enabled: z.boolean(),
});

export const WorkspaceFormFileValueSchema = z.object({
  name: z.string().min(1).max(240),
  url: z.string().url().max(2000),
  path: z.string().min(1).max(500),
  mimeType: z.string().min(1).max(120),
  size: z.number().int().min(1).max(WORKSPACE_FORM_UPLOAD_MAX_BYTES),
});

const PublicFormValuesSchema = z
  .record(
    z.string().max(80),
    z.union([z.string().max(2000), z.boolean(), WorkspaceFormFileValueSchema]),
  )
  .default({});

export const PublicWorkspaceFormSubmitSchema = z.object({
  token: z.string().min(16).max(128),
  values: PublicFormValuesSchema,
  listingId: z.string().uuid().optional().nullable(),
  propertyId: z.string().uuid().optional().nullable(),
  /** Resume-later draft token — consumed after a successful submit. */
  resumeToken: z.string().min(16).max(128).optional(),
  /** Honeypot — bots fill this; humans leave empty. */
  website: z.string().max(200).optional().or(z.literal('')),
});

export const PublicWorkspaceFormDraftSchema = z.object({
  token: z.string().min(16).max(128),
  values: PublicFormValuesSchema,
  stepIndex: z.number().int().min(0).max(80).optional().default(0),
  listingId: z.string().uuid().optional().nullable(),
  propertyId: z.string().uuid().optional().nullable(),
  resumeToken: z.string().min(16).max(128).optional(),
  embed: z.boolean().optional(),
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
export type DeleteWorkspaceFormSubmissionInput = z.infer<
  typeof DeleteWorkspaceFormSubmissionSchema
>;
export type PublishWorkspaceFormInput = z.infer<
  typeof PublishWorkspaceFormSchema
>;
export type PublicWorkspaceFormSubmitInput = z.infer<
  typeof PublicWorkspaceFormSubmitSchema
>;
export type PublicWorkspaceFormDraftInput = z.infer<
  typeof PublicWorkspaceFormDraftSchema
>;
