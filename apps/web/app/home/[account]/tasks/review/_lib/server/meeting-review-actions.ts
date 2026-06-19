'use server';

import { revalidatePath } from 'next/cache';

import { z } from 'zod';

import { enhanceAction } from '@kit/next/actions';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

import pathsConfig from '~/config/paths.config';
import { workAccountPath } from '~/home/[account]/_lib/work-account-path';
import {
  isHighConfidenceMeetingSuggestion,
  publishMeetingTaskToPlanner,
} from '~/lib/recorder/publish-meeting-task';

function revalidateReviewPages(accountSlug: string) {
  const slug = accountSlug.trim();
  if (!slug) return;

  const reviewPath = workAccountPath(pathsConfig.app.accountTasksReview, slug);
  const tasksPath = workAccountPath(pathsConfig.app.accountTasks, slug);

  revalidatePath(reviewPath, 'page');
  revalidatePath(tasksPath, 'page');
  revalidatePath(`/home/${slug}/tasks/review`, 'page');
  revalidatePath(`/home/${slug}/tasks`, 'page');
}

async function assertWorkspaceMember(accountId: string, userId: string) {
  const client = getSupabaseServerClient();
  const { data, error } = await client
    .from('accounts_memberships')
    .select('account_id')
    .eq('account_id', accountId)
    .eq('user_id', userId)
    .maybeSingle();

  if (error || !data) {
    throw new Error('You do not have access to this workspace');
  }
}

const reviewItemSchema = z.object({
  accountId: z.string().uuid(),
  accountSlug: z.string().min(1),
  meetingActionItemId: z.string().uuid(),
  assigneeId: z.string().uuid(),
  title: z.string().min(1).max(500).optional(),
  description: z.string().max(5000).nullable().optional(),
  dueDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .optional(),
});

export const approveMeetingActionItem = enhanceAction(
  async (input, user) => {
    await assertWorkspaceMember(input.accountId, user.id);

    const client = getSupabaseServerClient();
    const result = await publishMeetingTaskToPlanner(client, {
      meetingActionItemId: input.meetingActionItemId,
      accountId: input.accountId,
      assigneeId: input.assigneeId,
      reviewedByUserId: user.id,
      publishSource: 'manual',
      title: input.title,
      description: input.description,
      dueDate: input.dueDate,
    });

    revalidateReviewPages(input.accountSlug);

    return result;
  },
  { schema: reviewItemSchema },
);

const rejectSchema = z.object({
  accountId: z.string().uuid(),
  accountSlug: z.string().min(1),
  meetingActionItemId: z.string().uuid(),
});

export const rejectMeetingActionItem = enhanceAction(
  async (input, user) => {
    await assertWorkspaceMember(input.accountId, user.id);

    const client = getSupabaseServerClient();
    const { data, error } = await client
      .from('meeting_action_items')
      .update({
        status: 'rejected',
        reviewed_at: new Date().toISOString(),
        reviewed_by: user.id,
      })
      .eq('id', input.meetingActionItemId)
      .eq('account_id', input.accountId)
      .eq('status', 'pending_review')
      .select('id')
      .maybeSingle();

    if (error) {
      throw new Error(error.message);
    }

    if (!data) {
      throw new Error('Suggestion not found or already reviewed');
    }

    revalidateReviewPages(input.accountSlug);

    return { id: data.id as string };
  },
  { schema: rejectSchema },
);

const bulkApproveSchema = z.object({
  accountId: z.string().uuid(),
  accountSlug: z.string().min(1),
});

export const bulkApproveHighConfidenceMeetingItems = enhanceAction(
  async (input, user) => {
    await assertWorkspaceMember(input.accountId, user.id);

    const client = getSupabaseServerClient();
    const { data: rows, error } = await client
      .from('meeting_action_items')
      .select(
        'id, suggested_title, suggested_description, suggested_due_date, assignee_confidence, suggested_assignee_id',
      )
      .eq('account_id', input.accountId)
      .eq('status', 'pending_review');

    if (error) {
      throw new Error(error.message);
    }

    const eligible = (rows ?? []).filter((row) =>
      isHighConfidenceMeetingSuggestion({
        assigneeConfidence: (row as { assignee_confidence: number | null })
          .assignee_confidence,
        suggestedAssigneeId: (row as { suggested_assignee_id: string | null })
          .suggested_assignee_id,
      }),
    ) as Array<{
      id: string;
      suggested_title: string;
      suggested_description: string | null;
      suggested_due_date: string | null;
      suggested_assignee_id: string;
    }>;

    if (eligible.length === 0) {
      return { publishedCount: 0, plannerTaskIds: [] as string[] };
    }

    const plannerTaskIds: string[] = [];

    for (const item of eligible) {
      const result = await publishMeetingTaskToPlanner(client, {
        meetingActionItemId: item.id,
        accountId: input.accountId,
        assigneeId: item.suggested_assignee_id,
        reviewedByUserId: user.id,
        publishSource: 'manual',
        title: item.suggested_title,
        description: item.suggested_description,
        dueDate: item.suggested_due_date,
      });
      plannerTaskIds.push(result.plannerTaskId);
    }

    revalidateReviewPages(input.accountSlug);

    return {
      publishedCount: plannerTaskIds.length,
      plannerTaskIds,
    };
  },
  { schema: bulkApproveSchema },
);
