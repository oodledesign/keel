'use server';

import 'server-only';

import { revalidatePath } from 'next/cache';

import { z } from 'zod';

import { enhanceAction } from '@kit/next/actions';
import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { createTaskForUser } from '@kit/tasks/create-task';

import pathsConfig from '~/config/paths.config';

const ScopeObjectSchema = z.object({
  accountId: z.string().uuid(),
  accountSlug: z.string().min(1).max(200).optional().nullable(),
  pipelineDealId: z.string().uuid().optional().nullable(),
  commercialRequirementId: z.string().uuid().optional().nullable(),
});

const withWipScope = <T extends z.ZodTypeAny>(schema: T) =>
  schema.refine(
    (d: z.infer<typeof ScopeObjectSchema>) =>
      Boolean(d.pipelineDealId || d.commercialRequirementId),
    { message: 'Provide a pipeline deal or requirement id' },
  );

const ScopeSchema = withWipScope(ScopeObjectSchema);


export type WipAttachmentTask = {
  id: string;
  title: string;
  status: string;
  dueDate: string | null;
};

export type WipAttachmentNote = {
  id: string;
  title: string;
  content: string;
  updatedAt: string;
};

export const listWipAttachmentTasks = enhanceAction(
  async (input) => {
    const client = getSupabaseServerClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let query = (client as any)
      .from('tasks')
      .select('id, title, status, due_date')
      .eq('account_id', input.accountId)
      .neq('status', 'done')
      .neq('status', 'cancelled')
      .order('due_date', { ascending: true, nullsFirst: false })
      .limit(8);

    if (input.pipelineDealId) {
      query = query.eq('pipeline_deal_id', input.pipelineDealId);
    } else {
      query = query.eq(
        'commercial_requirement_id',
        input.commercialRequirementId,
      );
    }

    const { data, error } = await query;
    if (error) throw new Error(error.message);

    return ((data ?? []) as Array<{
      id: string;
      title: string;
      status: string;
      due_date: string | null;
    }>).map((row) => ({
      id: row.id,
      title: row.title,
      status: row.status,
      dueDate: row.due_date,
    })) satisfies WipAttachmentTask[];
  },
  { schema: ScopeSchema },
);

export const listWipAttachmentNotes = enhanceAction(
  async (input) => {
    const client = getSupabaseServerClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let query = (client as any)
      .from('notes')
      .select('id, title, content, updated_at')
      .eq('account_id', input.accountId)
      .order('updated_at', { ascending: false })
      .limit(6);

    if (input.pipelineDealId) {
      query = query.eq('pipeline_deal_id', input.pipelineDealId);
    } else {
      query = query.eq(
        'commercial_requirement_id',
        input.commercialRequirementId,
      );
    }

    const { data, error } = await query;
    if (error) throw new Error(error.message);

    return ((data ?? []) as Array<{
      id: string;
      title: string;
      content: string;
      updated_at: string;
    }>).map((row) => ({
      id: row.id,
      title: row.title?.trim() || 'Untitled',
      content: row.content ?? '',
      updatedAt: row.updated_at,
    })) satisfies WipAttachmentNote[];
  },
  { schema: ScopeSchema },
);

const CreateTaskSchema = withWipScope(
  ScopeObjectSchema.extend({
    title: z.string().trim().min(1).max(200),
    dueDate: z.string().optional().nullable(),
  }),
);

export const createWipAttachmentTask = enhanceAction(
  async (input, user) => {
    const client = getSupabaseServerClient();
    const result = await createTaskForUser(client, user.id, {
      title: input.title,
      accountId: input.accountId,
      dueDate: input.dueDate || undefined,
      pipelineDealId: input.pipelineDealId || undefined,
      commercialRequirementId: input.commercialRequirementId || undefined,
      source: 'wip_board',
    });

    if (!result.success) {
      throw new Error(result.error || 'Could not create task');
    }

    const slug = input.accountSlug?.trim();
    if (slug) {
      revalidatePath(
        pathsConfig.app.accountPipeline.replace('[account]', slug),
      );
    }

    return { id: result.id };
  },
  { schema: CreateTaskSchema },
);

const CreateNoteSchema = withWipScope(
  ScopeObjectSchema.extend({
    content: z.string().trim().min(1).max(5000),
    title: z.string().trim().max(200).optional().nullable(),
  }),
);

export const createWipAttachmentNote = enhanceAction(
  async (input, user) => {
    const client = getSupabaseServerClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (client as any)
      .from('notes')
      .insert({
        account_id: input.accountId,
        title: input.title?.trim() || '',
        content: input.content.trim(),
        category: 'idea',
        created_by: user.id,
        user_id: user.id,
        pipeline_deal_id: input.pipelineDealId || null,
        commercial_requirement_id: input.commercialRequirementId || null,
      })
      .select('id')
      .single();

    if (error) throw new Error(error.message);

    const slug = input.accountSlug?.trim();
    if (slug) {
      revalidatePath(
        pathsConfig.app.accountPipeline.replace('[account]', slug),
      );
    }

    return { id: data.id as string };
  },
  { schema: CreateNoteSchema },
);
