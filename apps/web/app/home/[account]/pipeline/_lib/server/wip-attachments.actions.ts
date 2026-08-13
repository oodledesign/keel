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

export type WipPersonRef = {
  id: string;
  name: string;
};

export type WipAttachmentNote = {
  id: string;
  title: string;
  content: string;
  createdAt: string;
  updatedAt: string;
  createdBy: WipPersonRef | null;
  assignedTo: WipPersonRef | null;
};

export type WipDeskActivityItem = {
  id: string;
  content: string;
  createdAt: string;
  createdBy: WipPersonRef | null;
  assignedTo: WipPersonRef | null;
  pipelineDealId: string | null;
  commercialRequirementId: string | null;
  instructionTitle: string | null;
};

type NoteRow = {
  id: string;
  title: string | null;
  content: string | null;
  created_at: string | null;
  updated_at: string | null;
  created_by: string | null;
  assigned_to: string | null;
  pipeline_deal_id?: string | null;
  commercial_requirement_id?: string | null;
};

async function resolveAccountNames(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  client: any,
  userIds: string[],
): Promise<Map<string, string>> {
  const unique = [...new Set(userIds.filter(Boolean))];
  const map = new Map<string, string>();
  if (unique.length === 0) return map;

  const { data } = await client
    .from('accounts')
    .select('id, name')
    .in('id', unique);

  for (const row of (data ?? []) as Array<{
    id: string;
    name?: string | null;
  }>) {
    map.set(row.id, row.name?.trim() || 'Member');
  }

  for (const id of unique) {
    if (!map.has(id)) map.set(id, 'Member');
  }

  return map;
}

function mapNoteRow(
  row: NoteRow,
  names: Map<string, string>,
): WipAttachmentNote {
  const createdById = row.created_by;
  const assignedToId = row.assigned_to;
  const rawContent = row.content ?? '';
  const content = rawContent.replace(/^\[import_key:[^\]]+\]\n?/, '');
  return {
    id: row.id,
    title: row.title?.trim() || 'Untitled',
    content,
    createdAt: row.created_at ?? row.updated_at ?? new Date().toISOString(),
    updatedAt: row.updated_at ?? row.created_at ?? new Date().toISOString(),
    createdBy: createdById
      ? { id: createdById, name: names.get(createdById) ?? 'Member' }
      : null,
    assignedTo: assignedToId
      ? { id: assignedToId, name: names.get(assignedToId) ?? 'Member' }
      : null,
  };
}

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

    return (
      (data ?? []) as Array<{
        id: string;
        title: string;
        status: string;
        due_date: string | null;
      }>
    ).map((row) => ({
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
      .select(
        'id, title, content, created_at, updated_at, created_by, assigned_to',
      )
      .eq('account_id', input.accountId)
      .order('created_at', { ascending: true })
      .limit(50);

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

    const rows = (data ?? []) as NoteRow[];
    const names = await resolveAccountNames(
      client,
      rows.flatMap(
        (row) => [row.created_by, row.assigned_to].filter(Boolean) as string[],
      ),
    );

    return rows.map((row) => mapNoteRow(row, names));
  },
  { schema: ScopeSchema },
);

const DeskActivitySchema = z.object({
  accountId: z.string().uuid(),
  limit: z.number().int().min(1).max(50).optional(),
});

export const listWipDeskActivity = enhanceAction(
  async (input) => {
    const client = getSupabaseServerClient();
    const limit = input.limit ?? 30;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (client as any)
      .from('notes')
      .select(
        'id, title, content, created_at, updated_at, created_by, assigned_to, pipeline_deal_id, commercial_requirement_id',
      )
      .eq('account_id', input.accountId)
      .not('pipeline_deal_id', 'is', null)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw new Error(error.message);

    const rows = (data ?? []) as NoteRow[];
    const dealIds = [
      ...new Set(
        rows
          .map((row) => row.pipeline_deal_id)
          .filter((id): id is string => Boolean(id)),
      ),
    ];

    const titleByDeal = new Map<string, string>();
    if (dealIds.length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: deals } = await (client as any)
        .from('pipeline_deals')
        .select('id, name, company_name, contact_name')
        .in('id', dealIds);

      for (const deal of (deals ?? []) as Array<{
        id: string;
        name?: string | null;
        company_name?: string | null;
        contact_name?: string | null;
      }>) {
        const title =
          deal.name?.trim() ||
          deal.company_name?.trim() ||
          deal.contact_name?.trim() ||
          'Instruction';
        titleByDeal.set(deal.id, title);
      }
    }

    const names = await resolveAccountNames(
      client,
      rows.flatMap(
        (row) => [row.created_by, row.assigned_to].filter(Boolean) as string[],
      ),
    );

    return rows.map((row) => {
      const mapped = mapNoteRow(row, names);
      return {
        id: mapped.id,
        content: mapped.content,
        createdAt: mapped.createdAt,
        createdBy: mapped.createdBy,
        assignedTo: mapped.assignedTo,
        pipelineDealId: row.pipeline_deal_id ?? null,
        commercialRequirementId: row.commercial_requirement_id ?? null,
        instructionTitle: row.pipeline_deal_id
          ? (titleByDeal.get(row.pipeline_deal_id) ?? 'Instruction')
          : null,
      } satisfies WipDeskActivityItem;
    });
  },
  { schema: DeskActivitySchema },
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
    assignedToUserId: z.string().uuid().optional().nullable(),
  }),
);

export const createWipAttachmentNote = enhanceAction(
  async (input, user) => {
    const client = getSupabaseServerClient();

    if (input.assignedToUserId) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { count, error: membershipError } = await (client as any)
        .from('accounts_memberships')
        .select('*', { count: 'exact', head: true })
        .eq('account_id', input.accountId)
        .eq('user_id', input.assignedToUserId);

      if (membershipError) {
        throw new Error(membershipError.message);
      }
      if (!count) {
        throw new Error('Assignee is not a member of this account');
      }
    }

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
        assigned_to: input.assignedToUserId || null,
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

const ListMembersSchema = z.object({
  accountId: z.string().uuid(),
});

export const listWipTeamMembers = enhanceAction(
  async (input) => {
    const client = getSupabaseServerClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: memberships, error } = await (client as any)
      .from('accounts_memberships')
      .select('user_id')
      .eq('account_id', input.accountId);

    if (error) throw new Error(error.message);

    const userIds = [
      ...new Set(
        ((memberships ?? []) as Array<{ user_id: string }>).map(
          (row) => row.user_id,
        ),
      ),
    ];

    if (userIds.length === 0) return [];

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: accounts } = await (client as any)
      .from('accounts')
      .select('id, name, email, picture_url')
      .in('id', userIds);

    return (
      (accounts ?? []) as Array<{
        id: string;
        name?: string | null;
        email?: string | null;
        picture_url?: string | null;
      }>
    )
      .map((row) => ({
        id: row.id,
        label: row.name?.trim() || row.email?.trim() || 'Member',
        email: row.email?.trim() || null,
        pictureUrl: row.picture_url ?? null,
        kind: 'member' as const,
      }))
      .sort((a, b) => a.label.localeCompare(b.label));
  },
  { schema: ListMembersSchema },
);
