import 'server-only';

import { SupabaseClient } from '@supabase/supabase-js';

import { requireUser } from '@kit/supabase/require-user';

import pathsConfig from '~/config/paths.config';
import type { Database } from '~/lib/database.types';
import { createInAppNotification } from '~/lib/notifications/create-in-app-notification';
import { looseClient } from '~/lib/retainers/loose-client';

import type {
  AddCanvasCommentInput,
  DeleteCanvasCommentInput,
  ResolveCanvasCommentInput,
  UpdateCanvasCommentInput,
} from '../schema/project-canvas-comments.schema';
import type { ProjectCanvasComment } from '../schema/project-canvas.schema';

export const CANVAS_COMMENT_COLUMNS =
  'id, item_id, body, mentions, author_id, resolved_at, created_at, updated_at';

type CommentRow = {
  id: string;
  item_id: string;
  body: string;
  mentions: string[] | null;
  author_id: string;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
};

export function toCanvasComment(
  row: Record<string, unknown>,
): ProjectCanvasComment {
  const r = row as unknown as CommentRow;
  return {
    id: r.id,
    itemId: r.item_id,
    body: r.body,
    mentions: r.mentions ?? [],
    authorId: r.author_id,
    resolvedAt: r.resolved_at,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export function canvasItemLink(
  accountSlug: string,
  jobId: string,
  itemId: string,
) {
  const path = pathsConfig.app.accountJobDetail
    .replace('[account]', accountSlug)
    .replace('[id]', jobId);
  return `${path}?view=canvas&canvasItem=${itemId}`;
}

function snippet(text: string, max = 140) {
  const flat = text.replace(/\s+/g, ' ').trim();
  return flat.length > max ? `${flat.slice(0, max - 1)}…` : flat;
}

export function createProjectCanvasCommentsService(
  client: SupabaseClient<Database>,
) {
  return new ProjectCanvasCommentsService(client);
}

class ProjectCanvasCommentsService {
  constructor(private readonly client: SupabaseClient<Database>) {}

  private get table() {
    return looseClient(this.client).from('project_canvas_comments');
  }

  private async requireUserId() {
    const { data, error } = await requireUser(this.client);
    if (error || !data) throw new Error('Authentication required');
    return data.id;
  }

  async add(input: AddCanvasCommentInput): Promise<ProjectCanvasComment> {
    const userId = await this.requireUserId();
    const mentions = [...new Set(input.mentions)].filter((id) => id !== userId);

    const { data, error } = await this.table
      .insert({
        account_id: input.accountId,
        project_id: input.jobId,
        item_id: input.itemId,
        body: input.body,
        mentions,
        author_id: userId,
      })
      .select(CANVAS_COMMENT_COLUMNS)
      .single();
    if (error) throw new Error(error.message);
    const comment = toCanvasComment(data as Record<string, unknown>);

    if (mentions.length > 0) {
      try {
        await this.notifyMentions(input, userId, mentions, comment.body);
      } catch (notifyError) {
        // The comment is saved; a retry would duplicate it.
        console.warn('[canvas-comments] mention notification failed', {
          error:
            notifyError instanceof Error ? notifyError.message : notifyError,
        });
      }
    }
    return comment;
  }

  private async notifyMentions(
    input: AddCanvasCommentInput,
    authorId: string,
    mentions: string[],
    body: string,
  ) {
    const [members, author, project] = await Promise.all([
      this.client
        .from('accounts_memberships')
        .select('user_id')
        .eq('account_id', input.accountId)
        .in('user_id', mentions),
      this.client
        .from('accounts')
        .select('name')
        .eq('id', authorId)
        .maybeSingle(),
      this.client
        .from('projects')
        .select('title, name')
        .eq('id', input.jobId)
        .eq('account_id', input.accountId)
        .maybeSingle(),
    ]);
    if (members.error) {
      console.warn('[canvas-comments] mention lookup failed', {
        error: members.error.message,
      });
      return;
    }

    const authorName = author.data?.name?.trim() || 'Someone';
    const projectRow = project.data as {
      title: string | null;
      name: string | null;
    } | null;
    const projectTitle =
      projectRow?.title?.trim() || projectRow?.name?.trim() || 'a project';
    const link = canvasItemLink(input.accountSlug, input.jobId, input.itemId);

    await Promise.all(
      (members.data ?? []).map((member) =>
        createInAppNotification({
          accountId: member.user_id,
          body: `${authorName} mentioned you on the ${projectTitle} canvas: “${snippet(body)}”`,
          link,
        }),
      ),
    );
  }

  async update(input: UpdateCanvasCommentInput): Promise<ProjectCanvasComment> {
    const userId = await this.requireUserId();
    const { data, error } = await this.table
      .update({ body: input.body })
      .eq('id', input.commentId)
      .eq('project_id', input.jobId)
      .eq('author_id', userId)
      .select(CANVAS_COMMENT_COLUMNS)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) throw new Error('Only the author can edit this comment');
    return toCanvasComment(data as Record<string, unknown>);
  }

  async resolve(
    input: ResolveCanvasCommentInput,
  ): Promise<ProjectCanvasComment> {
    await this.requireUserId();
    const { data, error } = await this.table
      .update({ resolved_at: input.resolved ? new Date().toISOString() : null })
      .eq('id', input.commentId)
      .eq('project_id', input.jobId)
      .eq('account_id', input.accountId)
      .select(CANVAS_COMMENT_COLUMNS)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) throw new Error("You can't resolve this comment");
    return toCanvasComment(data as Record<string, unknown>);
  }

  async delete(input: DeleteCanvasCommentInput) {
    await this.requireUserId();
    const { data, error } = await this.table
      .delete()
      .eq('id', input.commentId)
      .eq('project_id', input.jobId)
      .eq('account_id', input.accountId)
      .select('id');
    if (error) throw new Error(error.message);
    if (!data || data.length === 0) {
      throw new Error("You can't delete this comment");
    }
    return { id: input.commentId };
  }
}
