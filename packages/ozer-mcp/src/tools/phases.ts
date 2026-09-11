import type { SupabaseClient } from '@supabase/supabase-js';

import { z } from 'zod';

import {
  type McpWorkspace,
  assertSupabaseOk,
  loadUserWorkspaces,
  pickDefined,
  toolJson,
} from './shared';
import type { OzerMcpToolRegistrar } from './types';

export const phaseStatusSchema = z.enum([
  'not_started',
  'in_progress',
  'blocked',
  'complete',
]);

export const listProjectPhasesSchema = z.object({
  project_id: z
    .string()
    .uuid()
    .describe('Delivery project to list phases for (ordered by sort_order).'),
});

export const createProjectPhaseSchema = z.object({
  project_id: z
    .string()
    .uuid()
    .describe('Phased delivery project to add a phase to.'),
  name: z.string().trim().min(1).max(200),
  description: z.string().optional(),
  status: phaseStatusSchema.optional().default('not_started'),
  is_milestone: z.boolean().optional().default(false),
  colour: z.string().trim().max(32).nullable().optional(),
  start_date: z.string().trim().optional(),
  due_date: z.string().trim().optional(),
  sort_order: z
    .number()
    .int()
    .min(0)
    .optional()
    .describe(
      'Optional explicit order. Omit to append after existing phases (same as the web app).',
    ),
});

export const updateProjectPhaseSchema = z.object({
  id: z.string().uuid(),
  name: z.string().trim().min(1).max(200).optional(),
  description: z.string().nullable().optional(),
  status: phaseStatusSchema.optional(),
  is_milestone: z.boolean().optional(),
  colour: z.string().trim().max(32).nullable().optional(),
  start_date: z.string().trim().nullable().optional(),
  due_date: z.string().trim().nullable().optional(),
  sort_order: z
    .number()
    .int()
    .min(0)
    .optional()
    .describe('Set to reorder this phase among siblings.'),
});

export const deleteProjectPhaseSchema = z.object({
  id: z.string().uuid(),
});

export type PhaseRow = {
  id: string;
  account_id?: string | null;
  project_id?: string | null;
  name?: string | null;
  description?: string | null;
  status?: string | null;
  is_milestone?: boolean | null;
  colour?: string | null;
  sort_order?: number | null;
  start_date?: string | null;
  due_date?: string | null;
  completed_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

export const PHASE_SELECT =
  'id, account_id, project_id, name, description, status, is_milestone, colour, sort_order, start_date, due_date, completed_at, created_at, updated_at';

export function mapPhase(row: PhaseRow) {
  return {
    id: row.id,
    account_id: row.account_id ?? null,
    project_id: row.project_id ?? null,
    name: row.name ?? null,
    description: row.description ?? null,
    status: row.status ?? 'not_started',
    is_milestone: Boolean(row.is_milestone),
    colour: row.colour ?? null,
    sort_order: row.sort_order ?? 0,
    start_date: row.start_date ?? null,
    due_date: row.due_date ?? null,
    completed_at: row.completed_at ?? null,
    created_at: row.created_at ?? null,
    updated_at: row.updated_at ?? null,
  };
}

export function nextPhaseSortOrder(maxSort: number | null | undefined): number {
  return (maxSort ?? -1) + 1;
}

export function assertAccountInWorkspaces(
  workspaces: McpWorkspace[],
  accountId: string | null | undefined,
  notFoundMessage = 'Project not found',
): asserts accountId is string {
  if (
    !accountId ||
    !workspaces.some((workspace) => workspace.id === accountId)
  ) {
    throw new Error(notFoundMessage);
  }
}

export function buildCreatePhaseInsert(
  input: z.infer<typeof createProjectPhaseSchema>,
  accountId: string,
  userId: string,
  sortOrder: number,
) {
  return {
    account_id: accountId,
    project_id: input.project_id,
    name: input.name.trim(),
    description: input.description?.trim() || null,
    status: input.status ?? 'not_started',
    is_milestone: input.is_milestone ?? false,
    colour: input.colour ?? null,
    sort_order: sortOrder,
    start_date: input.start_date ?? null,
    due_date: input.due_date ?? null,
    created_by: userId,
  };
}

export function buildUpdatePhasePatch(
  input: z.infer<typeof updateProjectPhaseSchema>,
  existingStatus?: string | null,
  now: () => string = () => new Date().toISOString(),
) {
  const payload: Record<string, unknown> = pickDefined({
    name: input.name,
    description:
      input.description === undefined
        ? undefined
        : input.description?.trim() || null,
    status: input.status,
    is_milestone: input.is_milestone,
    colour: input.colour,
    start_date: input.start_date,
    due_date: input.due_date,
    sort_order: input.sort_order,
  });

  if (input.status !== undefined) {
    if (input.status === 'complete') {
      payload.completed_at = now();
    } else if (existingStatus === 'complete') {
      payload.completed_at = null;
    }
  }

  return payload;
}

export async function loadAuthorizedProject(
  supabase: SupabaseClient,
  userId: string,
  projectId: string,
) {
  const workspaces = await loadUserWorkspaces(supabase, userId);
  const { data, error } = await supabase
    .from('projects')
    .select('id, account_id, is_phased')
    .eq('id', projectId)
    .maybeSingle();

  assertSupabaseOk(data, error, 'get project');

  const project = data as {
    id: string;
    account_id?: string | null;
    is_phased?: boolean | null;
  } | null;

  if (!project) {
    throw new Error('Project not found');
  }

  assertAccountInWorkspaces(workspaces, project.account_id);
  return { project, workspaces, accountId: project.account_id };
}

export async function loadAuthorizedPhase(
  supabase: SupabaseClient,
  userId: string,
  phaseId: string,
) {
  const workspaces = await loadUserWorkspaces(supabase, userId);
  const { data, error } = await supabase
    .from('project_phases')
    .select(PHASE_SELECT)
    .eq('id', phaseId)
    .maybeSingle();

  assertSupabaseOk(data, error, 'get project phase');

  if (!data) {
    throw new Error('Phase not found');
  }

  const phase = data as PhaseRow;
  assertAccountInWorkspaces(workspaces, phase.account_id, 'Phase not found');

  return { phase, workspaces, accountId: phase.account_id as string };
}

async function nextSortOrderForProject(
  supabase: SupabaseClient,
  projectId: string,
  accountId: string,
): Promise<number> {
  const { data, error } = await supabase
    .from('project_phases')
    .select('sort_order')
    .eq('account_id', accountId)
    .eq('project_id', projectId)
    .order('sort_order', { ascending: false })
    .limit(1)
    .maybeSingle();

  assertSupabaseOk(data, error, 'load phase order');
  return nextPhaseSortOrder(
    (data as { sort_order?: number | null } | null)?.sort_order,
  );
}

export async function listProjectPhases(
  supabase: SupabaseClient,
  userId: string,
  input: z.infer<typeof listProjectPhasesSchema>,
) {
  const { accountId } = await loadAuthorizedProject(
    supabase,
    userId,
    input.project_id,
  );

  const { data, error } = await supabase
    .from('project_phases')
    .select(PHASE_SELECT)
    .eq('account_id', accountId)
    .eq('project_id', input.project_id)
    .order('sort_order', { ascending: true });

  assertSupabaseOk(data, error, 'list project phases');

  return {
    phases: ((data ?? []) as PhaseRow[]).map(mapPhase),
  };
}

export async function createProjectPhase(
  supabase: SupabaseClient,
  userId: string,
  input: z.infer<typeof createProjectPhaseSchema>,
) {
  const { accountId } = await loadAuthorizedProject(
    supabase,
    userId,
    input.project_id,
  );

  const sortOrder =
    input.sort_order ??
    (await nextSortOrderForProject(supabase, input.project_id, accountId));

  const { data, error } = await supabase
    .from('project_phases')
    .insert(buildCreatePhaseInsert(input, accountId, userId, sortOrder))
    .select(PHASE_SELECT)
    .single();

  assertSupabaseOk(data, error, 'create project phase');

  return { phase: mapPhase(data as PhaseRow) };
}

export async function updateProjectPhase(
  supabase: SupabaseClient,
  userId: string,
  input: z.infer<typeof updateProjectPhaseSchema>,
) {
  const { phase, accountId } = await loadAuthorizedPhase(
    supabase,
    userId,
    input.id,
  );

  const updates = buildUpdatePhasePatch(input, phase.status);
  if (Object.keys(updates).length === 0) {
    throw new Error('Provide at least one field to update');
  }

  const { data, error } = await supabase
    .from('project_phases')
    .update(updates)
    .eq('id', input.id)
    .eq('account_id', accountId)
    .eq('project_id', phase.project_id)
    .select(PHASE_SELECT)
    .maybeSingle();

  assertSupabaseOk(data, error, 'update project phase');

  if (!data) {
    throw new Error('Phase not found');
  }

  return { phase: mapPhase(data as PhaseRow) };
}

export async function deleteProjectPhase(
  supabase: SupabaseClient,
  userId: string,
  input: z.infer<typeof deleteProjectPhaseSchema>,
) {
  const { phase, accountId } = await loadAuthorizedPhase(
    supabase,
    userId,
    input.id,
  );

  const { error } = await supabase
    .from('project_phases')
    .delete()
    .eq('id', input.id)
    .eq('account_id', accountId)
    .eq('project_id', phase.project_id);

  assertSupabaseOk(null, error, 'delete project phase');

  return {
    deleted: true,
    id: input.id,
    project_id: phase.project_id ?? null,
    tasks_unphased: true,
  };
}

export const registerPhaseTools: OzerMcpToolRegistrar = (server, context) => {
  const { supabase, userId } = context;

  server.registerTool(
    'list_project_phases',
    {
      description:
        'List delivery phases for a project, ordered by sort_order. The project must be in a workspace the user belongs to. Use after setting is_phased=true (or to inspect an already-phased project).',
      inputSchema: listProjectPhasesSchema,
    },
    async (input) => toolJson(await listProjectPhases(supabase, userId, input)),
  );

  server.registerTool(
    'create_project_phase',
    {
      description:
        'Create a phase on a delivery project (name required). Optional description, status, dates, colour, milestone, and sort_order. Set is_phased=true on the project first so the Phase board appears in Ozer; this tool does not flip that flag or invent a template. Appends after existing phases unless sort_order is provided.',
      inputSchema: createProjectPhaseSchema,
    },
    async (input) =>
      toolJson(await createProjectPhase(supabase, userId, input)),
  );

  server.registerTool(
    'update_project_phase',
    {
      description:
        'Patch a project phase the user can access: name, description, status, dates, colour, milestone, or sort_order. Marking status=complete sets completed_at (cleared when leaving complete). Only provided fields change.',
      inputSchema: updateProjectPhaseSchema,
    },
    async (input) =>
      toolJson(await updateProjectPhase(supabase, userId, input)),
  );

  server.registerTool(
    'delete_project_phase',
    {
      description:
        'Delete a project phase. Tasks on that phase are unphased (phase_id set to null) the same way the web app does — they stay on the project. Does not delete the project or its tasks.',
      inputSchema: deleteProjectPhaseSchema,
    },
    async (input) =>
      toolJson(await deleteProjectPhase(supabase, userId, input)),
  );
};
