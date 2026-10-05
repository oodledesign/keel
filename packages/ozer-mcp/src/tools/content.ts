import type { SupabaseClient } from '@supabase/supabase-js';

import { z } from 'zod';

import { loadAuthorizedProject } from './phases';
import { assertSupabaseOk, pickDefined, toolJson } from './shared';
import type { OzerMcpToolRegistrar } from './types';

export const CONTENT_PLATFORMS = [
  'instagram',
  'facebook',
  'linkedin',
  'x',
  'tiktok',
  'youtube',
  'threads',
  'pinterest',
  'email',
  'blog',
  'other',
] as const;

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD')
  .describe('Date as YYYY-MM-DD.');

const postStatus = z.enum(['idea', 'draft', 'scheduled', 'posted']);
const platforms = z
  .array(z.enum(CONTENT_PLATFORMS))
  .max(12)
  .describe('One or more platforms the post goes out on.');

export const listContentPostsSchema = z.object({
  project_id: z.string().uuid(),
  from: isoDate.optional(),
  to: isoDate.optional(),
  status: postStatus.optional(),
});

export const createContentPostSchema = z.object({
  project_id: z.string().uuid(),
  post_date: isoDate,
  post_time: z
    .string()
    .regex(/^\d{2}:\d{2}$/, 'Use HH:MM')
    .nullable()
    .optional(),
  title: z.string().trim().min(1).max(300),
  body: z.string().max(20000).optional(),
  status: postStatus.optional().default('idea'),
  platforms: platforms.optional().default([]),
  link_url: z.string().trim().max(2000).nullable().optional(),
});

export const updateContentPostSchema = z.object({
  id: z.string().uuid(),
  post_date: isoDate.optional(),
  post_time: z
    .string()
    .regex(/^\d{2}:\d{2}$/)
    .nullable()
    .optional(),
  title: z.string().trim().min(1).max(300).optional(),
  body: z.string().max(20000).optional(),
  status: postStatus.optional(),
  platforms: platforms.optional(),
  link_url: z.string().trim().max(2000).nullable().optional(),
});

export const deleteContentPostSchema = z.object({ id: z.string().uuid() });

export const setPeriodNoteSchema = z.object({
  project_id: z.string().uuid(),
  period_kind: z.enum(['week', 'month']),
  period_start: isoDate.describe(
    'Monday for a week, the 1st for a month (YYYY-MM-DD).',
  ),
  body: z
    .string()
    .max(5000)
    .describe('Note text. An empty string clears the note.'),
});

export const listPeriodNotesSchema = z.object({
  project_id: z.string().uuid(),
});

const POST_SELECT =
  'id, account_id, project_id, post_date, post_time, title, body, status, platforms, link_url, posted_at, created_at, updated_at';

type PostRow = Record<string, unknown> & {
  id: string;
  account_id: string;
  project_id: string;
  status?: string;
};

/** Monday/1st alignment the web app relies on for note lookups. */
export function isValidPeriodStart(
  kind: 'week' | 'month',
  value: string,
): boolean {
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return false;
  return kind === 'week' ? date.getUTCDay() === 1 : date.getUTCDate() === 1;
}

export function buildPostPatch(
  input: z.infer<typeof updateContentPostSchema>,
  now: () => string = () => new Date().toISOString(),
) {
  const patch: Record<string, unknown> = pickDefined({
    post_date: input.post_date,
    post_time: input.post_time,
    title: input.title,
    body: input.body,
    status: input.status,
    platforms: input.platforms,
    link_url: input.link_url === undefined ? undefined : input.link_url || null,
  });
  if (input.status === 'posted') patch.posted_at = now();
  else if (input.status) patch.posted_at = null;
  return patch;
}

async function loadPost(supabase: SupabaseClient, userId: string, id: string) {
  const { data, error } = await supabase
    .from('project_content_posts')
    .select(POST_SELECT)
    .eq('id', id)
    .maybeSingle();
  assertSupabaseOk(data, error, 'get content post');
  if (!data) throw new Error('Post not found');
  const post = data as PostRow;
  // Confirms the user belongs to the post's workspace.
  await loadAuthorizedProject(supabase, userId, post.project_id);
  return post;
}

export async function listContentPosts(
  supabase: SupabaseClient,
  userId: string,
  input: z.infer<typeof listContentPostsSchema>,
) {
  const { accountId } = await loadAuthorizedProject(
    supabase,
    userId,
    input.project_id,
  );
  let query = supabase
    .from('project_content_posts')
    .select(POST_SELECT)
    .eq('account_id', accountId)
    .eq('project_id', input.project_id)
    .order('post_date', { ascending: true });
  if (input.from) query = query.gte('post_date', input.from);
  if (input.to) query = query.lte('post_date', input.to);
  if (input.status) query = query.eq('status', input.status);
  const { data, error } = await query;
  assertSupabaseOk(data, error, 'list content posts');
  return { posts: data ?? [] };
}

export async function createContentPost(
  supabase: SupabaseClient,
  userId: string,
  input: z.infer<typeof createContentPostSchema>,
) {
  const { accountId } = await loadAuthorizedProject(
    supabase,
    userId,
    input.project_id,
  );
  const { data, error } = await supabase
    .from('project_content_posts')
    .insert({
      account_id: accountId,
      project_id: input.project_id,
      post_date: input.post_date,
      post_time: input.post_time ?? null,
      title: input.title,
      body: input.body ?? '',
      status: input.status,
      platforms: input.platforms,
      link_url: input.link_url || null,
      posted_at: input.status === 'posted' ? new Date().toISOString() : null,
      created_by: userId,
    })
    .select(POST_SELECT)
    .single();
  assertSupabaseOk(data, error, 'create content post');
  return { post: data };
}

export async function updateContentPost(
  supabase: SupabaseClient,
  userId: string,
  input: z.infer<typeof updateContentPostSchema>,
) {
  const post = await loadPost(supabase, userId, input.id);
  const patch = buildPostPatch(input);
  if (Object.keys(patch).length === 0) {
    throw new Error('Provide at least one field to update');
  }
  const { data, error } = await supabase
    .from('project_content_posts')
    .update(patch)
    .eq('id', input.id)
    .eq('account_id', post.account_id)
    .select(POST_SELECT)
    .maybeSingle();
  assertSupabaseOk(data, error, 'update content post');
  if (!data) throw new Error('Post not found');
  return { post: data };
}

export async function deleteContentPost(
  supabase: SupabaseClient,
  userId: string,
  input: z.infer<typeof deleteContentPostSchema>,
) {
  const post = await loadPost(supabase, userId, input.id);
  const { error } = await supabase
    .from('project_content_posts')
    .delete()
    .eq('id', input.id)
    .eq('account_id', post.account_id);
  assertSupabaseOk(null, error, 'delete content post');
  return { deleted: true, id: input.id };
}

export async function listPeriodNotes(
  supabase: SupabaseClient,
  userId: string,
  input: z.infer<typeof listPeriodNotesSchema>,
) {
  const { accountId } = await loadAuthorizedProject(
    supabase,
    userId,
    input.project_id,
  );
  const { data, error } = await supabase
    .from('project_period_notes')
    .select('id, period_kind, period_start, body, updated_at')
    .eq('account_id', accountId)
    .eq('project_id', input.project_id)
    .order('period_start', { ascending: true });
  assertSupabaseOk(data, error, 'list period notes');
  return { notes: data ?? [] };
}

export async function setPeriodNote(
  supabase: SupabaseClient,
  userId: string,
  input: z.infer<typeof setPeriodNoteSchema>,
) {
  if (!isValidPeriodStart(input.period_kind, input.period_start)) {
    throw new Error(
      input.period_kind === 'week'
        ? 'period_start must be a Monday for a week note'
        : 'period_start must be the 1st for a month note',
    );
  }
  const { accountId } = await loadAuthorizedProject(
    supabase,
    userId,
    input.project_id,
  );

  if (!input.body.trim()) {
    const { error } = await supabase
      .from('project_period_notes')
      .delete()
      .eq('account_id', accountId)
      .eq('project_id', input.project_id)
      .eq('period_kind', input.period_kind)
      .eq('period_start', input.period_start);
    assertSupabaseOk(null, error, 'clear period note');
    return { cleared: true };
  }

  const { data, error } = await supabase
    .from('project_period_notes')
    .upsert(
      {
        account_id: accountId,
        project_id: input.project_id,
        period_kind: input.period_kind,
        period_start: input.period_start,
        body: input.body.trim(),
        updated_by: userId,
      },
      { onConflict: 'project_id,period_kind,period_start' },
    )
    .select('id, period_kind, period_start, body, updated_at')
    .single();
  assertSupabaseOk(data, error, 'save period note');
  return { note: data };
}

export const registerContentTools: OzerMcpToolRegistrar = (server, context) => {
  const { supabase, userId } = context;

  server.registerTool(
    'list_content_posts',
    {
      description:
        'List content calendar posts for a project, oldest first. Optionally filter by date range (from/to, YYYY-MM-DD) or status (idea, draft, scheduled, posted).',
      inputSchema: listContentPostsSchema,
    },
    async (input) => toolJson(await listContentPosts(supabase, userId, input)),
  );

  server.registerTool(
    'create_content_post',
    {
      description:
        'Add a post to a project content calendar on a given day. Choose one or more platforms (instagram, facebook, linkedin, x, tiktok, youtube, threads, pinterest, email, blog, other) and a status: idea, draft, scheduled or posted.',
      inputSchema: createContentPostSchema,
    },
    async (input) => toolJson(await createContentPost(supabase, userId, input)),
  );

  server.registerTool(
    'update_content_post',
    {
      description:
        'Patch a content post: move it to another day, edit title/copy, change platforms, or mark it scheduled / posted. Setting status=posted stamps posted_at. Only provided fields change.',
      inputSchema: updateContentPostSchema,
    },
    async (input) => toolJson(await updateContentPost(supabase, userId, input)),
  );

  server.registerTool(
    'delete_content_post',
    {
      description: 'Delete a content calendar post.',
      inputSchema: deleteContentPostSchema,
    },
    async (input) => toolJson(await deleteContentPost(supabase, userId, input)),
  );

  server.registerTool(
    'list_period_notes',
    {
      description:
        'List the week and month notes on a project (shown in the content calendar and roadmap).',
      inputSchema: listPeriodNotesSchema,
    },
    async (input) => toolJson(await listPeriodNotes(supabase, userId, input)),
  );

  server.registerTool(
    'set_period_note',
    {
      description:
        'Write the note for a week (period_start = Monday) or a month (period_start = the 1st). An empty body clears it.',
      inputSchema: setPeriodNoteSchema,
    },
    async (input) => toolJson(await setPeriodNote(supabase, userId, input)),
  );
};
