import { z } from 'zod';

export const ProjectSourceRefSchema = z.object({
  type: z.enum(['transcript', 'proposal', 'note', 'file']),
  id: z.string().uuid(),
  title: z.string().max(500),
});

export const ProjectContextRefSchema = z.object({
  type: z.enum(['transcript', 'proposal', 'note', 'file']),
  id: z.string().uuid(),
  title: z.string().max(500),
});

export const ProjectGenerateModeSchema = z.enum([
  'brief',
  'phase_plan',
  'phase_page',
]);

export const ListProjectAiSourcesSchema = z.object({
  accountId: z.string().uuid(),
  jobId: z.string().uuid(),
});

export const GenerateProjectContentSchema = z.object({
  accountId: z.string().uuid(),
  accountSlug: z.string().min(1),
  jobId: z.string().uuid(),
  phaseId: z.string().uuid().optional(),
  mode: ProjectGenerateModeSchema,
  sourceRefs: z.array(ProjectSourceRefSchema).min(1).max(24),
});

const PhasePlanTaskSchema = z.object({
  title: z.string().min(1).max(500),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
  due_date: z.string().nullable().optional(),
});

const PhasePlanPhaseSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(5000).nullable().optional(),
  start_date: z.string().nullable().optional(),
  due_date: z.string().nullable().optional(),
  is_milestone: z.boolean().optional(),
  colour: z.string().nullable().optional(),
  tasks: z.array(PhasePlanTaskSchema).default([]),
});

export const ApplyProjectPhasePlanSchema = z.object({
  accountId: z.string().uuid(),
  accountSlug: z.string().min(1),
  jobId: z.string().uuid(),
  contextRefs: z.array(ProjectContextRefSchema).optional(),
  phases: z.array(PhasePlanPhaseSchema).min(1),
});

export type ProjectSourceRef = z.infer<typeof ProjectSourceRefSchema>;
export type ProjectGenerateMode = z.infer<typeof ProjectGenerateModeSchema>;
export type ListProjectAiSourcesInput = z.infer<
  typeof ListProjectAiSourcesSchema
>;
export type GenerateProjectContentInput = z.infer<
  typeof GenerateProjectContentSchema
>;
export type ApplyProjectPhasePlanInput = z.infer<
  typeof ApplyProjectPhasePlanSchema
>;

export type ProjectAiSourceListItem = {
  id: string;
  type: 'transcript' | 'proposal' | 'note' | 'file';
  title: string;
  subtitle: string;
  preview: string;
  date?: string;
};

export type ProjectAiSourcesResult = {
  transcripts: ProjectAiSourceListItem[];
  proposals: ProjectAiSourceListItem[];
  notes: ProjectAiSourceListItem[];
  docs: ProjectAiSourceListItem[];
};
