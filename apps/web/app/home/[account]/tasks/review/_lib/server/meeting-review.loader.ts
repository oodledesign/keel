import 'server-only';

import { cache } from 'react';

import { getSupabaseServerClient } from '@kit/supabase/server-client';

import { loadTeamWorkspace } from '~/home/[account]/_lib/server/team-account-workspace.loader';
import { loadAccountTaskAutomationSettings } from '~/lib/recorder/task-automation-settings';

export type MeetingReviewMember = {
  userId: string;
  name: string;
  email: string;
};

export type MeetingReviewItem = {
  id: string;
  suggestedTitle: string;
  suggestedDescription: string | null;
  suggestedDueDate: string | null;
  sourceExcerpt: string | null;
  assigneeConfidence: number | null;
  suggestedAssigneeId: string | null;
  createdAt: string;
  meetingTranscriptId: string;
  meetingTitle: string;
  meetingDate: string | null;
};

export const loadMeetingTaskReviewPageData = cache(
  loadMeetingTaskReviewPageDataImpl,
);

async function loadMeetingTaskReviewPageDataImpl(accountSlug: string) {
  const workspace = await loadTeamWorkspace(accountSlug);
  const accountId = workspace.account.id as string;
  const client = getSupabaseServerClient();

  const [itemsResult, membersResult, automationSettings] = await Promise.all([
    client
      .from('meeting_action_items')
      .select(
        `
        id,
        suggested_title,
        suggested_description,
        suggested_due_date,
        source_excerpt,
        assignee_confidence,
        suggested_assignee_id,
        created_at,
        meeting_transcript_id,
        meeting_transcripts:meeting_transcript_id (
          title,
          meeting_date
        )
      `,
      )
      .eq('account_id', accountId)
      .eq('status', 'pending_review')
      .order('created_at', { ascending: false }),
    client.rpc('get_account_members', { account_slug: accountSlug }),
    loadAccountTaskAutomationSettings(client, accountId),
  ]);

  if (itemsResult.error) {
    throw new Error(itemsResult.error.message);
  }

  if (membersResult.error) {
    throw new Error(membersResult.error.message);
  }

  const members: MeetingReviewMember[] = (membersResult.data ?? [])
    .map((row) => {
      const member = row as {
        user_id?: string;
        name?: string | null;
        email?: string | null;
      };

      const userId = member.user_id?.trim();
      const email = member.email?.trim();

      if (!userId || !email) {
        return null;
      }

      return {
        userId,
        name: member.name?.trim() || email,
        email,
      };
    })
    .filter((member): member is MeetingReviewMember => member !== null);

  const items: MeetingReviewItem[] = (itemsResult.data ?? []).map((row) => {
    const item = row as {
      id: string;
      suggested_title: string;
      suggested_description: string | null;
      suggested_due_date: string | null;
      source_excerpt: string | null;
      assignee_confidence: number | null;
      suggested_assignee_id: string | null;
      created_at: string;
      meeting_transcript_id: string;
      meeting_transcripts:
        | { title?: string | null; meeting_date?: string | null }
        | Array<{ title?: string | null; meeting_date?: string | null }>
        | null;
    };

    const transcript = Array.isArray(item.meeting_transcripts)
      ? item.meeting_transcripts[0]
      : item.meeting_transcripts;

    return {
      id: item.id,
      suggestedTitle: item.suggested_title,
      suggestedDescription: item.suggested_description,
      suggestedDueDate: item.suggested_due_date,
      sourceExcerpt: item.source_excerpt,
      assigneeConfidence: item.assignee_confidence,
      suggestedAssigneeId: item.suggested_assignee_id,
      createdAt: item.created_at,
      meetingTranscriptId: item.meeting_transcript_id,
      meetingTitle: transcript?.title?.trim() || 'Meeting transcript',
      meetingDate: transcript?.meeting_date ?? null,
    };
  });

  return {
    accountId,
    accountSlug,
    items,
    members,
    automationSettings,
  };
}
