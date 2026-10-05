import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import type { z } from 'zod';

import type {
  ContentPlatform,
  ContentPost,
  ContentStatus,
  PeriodKind,
  PeriodNote,
} from '~/lib/projects/content/content-calendar';
import { monthStart, weekStart } from '~/lib/projects/content/content-calendar';

import type {
  DeleteContentPostSchema,
  SaveContentPostSchema,
  SavePeriodNoteSchema,
} from '../schema/project-content.schema';

function table(client: unknown, name: string) {
  return (
    client as {
      from: (tableName: string) => ReturnType<SupabaseClient['from']>;
    }
  ).from(name);
}

type PostRow = {
  id: string;
  post_date: string;
  post_time: string | null;
  title: string;
  body: string;
  status: ContentStatus;
  platforms: ContentPlatform[];
  link_url: string | null;
};

type NoteRow = {
  id: string;
  period_kind: PeriodKind;
  period_start: string;
  body: string;
};

const POST_COLUMNS =
  'id, post_date, post_time, title, body, status, platforms, link_url';
const NOTE_COLUMNS = 'id, period_kind, period_start, body';

export function postFromRow(row: PostRow): ContentPost {
  return {
    id: row.id,
    postDate: row.post_date,
    postTime: row.post_time ? row.post_time.slice(0, 5) : null,
    title: row.title,
    body: row.body ?? '',
    status: row.status,
    platforms: row.platforms ?? [],
    linkUrl: row.link_url,
  };
}

function noteFromRow(row: NoteRow): PeriodNote {
  return {
    id: row.id,
    kind: row.period_kind,
    periodStart: row.period_start,
    body: row.body,
  };
}

function fail(error: { message?: string } | null, fallback: string): never {
  throw new Error(error?.message || fallback);
}

export function createProjectContentService(client: SupabaseClient) {
  return {
    async load(input: { accountId: string; jobId: string }) {
      const [posts, notes] = await Promise.all([
        table(client, 'project_content_posts')
          .select(POST_COLUMNS)
          .eq('account_id', input.accountId)
          .eq('project_id', input.jobId)
          .order('post_date', { ascending: true })
          .limit(3000),
        table(client, 'project_period_notes')
          .select(NOTE_COLUMNS)
          .eq('account_id', input.accountId)
          .eq('project_id', input.jobId)
          .limit(1000),
      ]);

      if (posts.error) fail(posts.error, 'Could not load posts');
      if (notes.error) fail(notes.error, 'Could not load notes');

      return {
        posts: ((posts.data ?? []) as unknown as PostRow[]).map(postFromRow),
        notes: ((notes.data ?? []) as unknown as NoteRow[]).map(noteFromRow),
      };
    },

    async savePost(input: z.infer<typeof SaveContentPostSchema>) {
      const { post } = input;
      const values = {
        account_id: input.accountId,
        project_id: input.jobId,
        post_date: post.postDate,
        post_time: post.postTime || null,
        title: post.title,
        ...(post.body !== undefined && { body: post.body }),
        ...(post.status !== undefined && { status: post.status }),
        ...(post.platforms !== undefined && { platforms: post.platforms }),
        ...(post.linkUrl !== undefined && {
          link_url: post.linkUrl?.trim() || null,
        }),
      };

      if (post.id) {
        const { data, error } = await table(client, 'project_content_posts')
          .update(values)
          .eq('id', post.id)
          .eq('project_id', input.jobId)
          .select(POST_COLUMNS)
          .single();
        if (error) fail(error, 'Could not save the post');
        return postFromRow(data as unknown as PostRow);
      }

      const { data, error } = await table(client, 'project_content_posts')
        .insert(values)
        .select(POST_COLUMNS)
        .single();
      if (error) fail(error, 'Could not add the post');
      return postFromRow(data as unknown as PostRow);
    },

    async deletePost(input: z.infer<typeof DeleteContentPostSchema>) {
      const { error } = await table(client, 'project_content_posts')
        .delete()
        .eq('id', input.id)
        .eq('account_id', input.accountId)
        .eq('project_id', input.jobId);
      if (error) fail(error, 'Could not delete the post');
      return { id: input.id };
    },

    async saveNote(input: z.infer<typeof SavePeriodNoteSchema>) {
      const periodStart =
        input.kind === 'week'
          ? weekStart(input.periodStart)
          : monthStart(input.periodStart);

      if (!input.body.trim()) {
        const { error } = await table(client, 'project_period_notes')
          .delete()
          .eq('project_id', input.jobId)
          .eq('period_kind', input.kind)
          .eq('period_start', periodStart);
        if (error) fail(error, 'Could not clear the note');
        return null;
      }

      const { data, error } = await table(client, 'project_period_notes')
        .upsert(
          {
            account_id: input.accountId,
            project_id: input.jobId,
            period_kind: input.kind,
            period_start: periodStart,
            body: input.body,
          },
          { onConflict: 'project_id,period_kind,period_start' },
        )
        .select(NOTE_COLUMNS)
        .single();
      if (error) fail(error, 'Could not save the note');
      return noteFromRow(data as unknown as NoteRow);
    },
  };
}
