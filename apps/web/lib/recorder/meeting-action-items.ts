import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

import {
  loadAccountMembersForExtraction,
  resolveSuggestedAssigneeId,
  shouldIncludeExtractedItem,
} from '~/lib/email-assistant/account-members';
import {
  extractMeetingActionItems,
  type MeetingExtractedActionItem,
} from '~/lib/recorder/meeting-action-items-extract';

export type MeetingActionItemJobInput = {
  meetingTranscriptId: string;
  accountId: string;
  createdByUserId: string;
  title: string;
  content: string;
  summaryText: string | null;
  meetingDate?: string | null;
  calendarAttendees?: Array<{ name: string; email: string }>;
};

async function loadRecorderContext(
  admin: SupabaseClient,
  userId: string,
): Promise<{ email: string; name: string | null } | null> {
  const [{ data: authUser }, { data: personalAccount }] = await Promise.all([
    admin.auth.admin.getUserById(userId),
    admin.from('accounts').select('name, email').eq('id', userId).maybeSingle(),
  ]);

  const email =
    authUser?.user?.email?.trim() ||
    (personalAccount as { email?: string | null } | null)?.email?.trim() ||
    '';

  if (!email) {
    return null;
  }

  let name = (personalAccount as { name?: string | null } | null)?.name?.trim() || null;

  if (!name && authUser?.user?.user_metadata) {
    const meta = authUser.user.user_metadata as Record<string, unknown>;
    for (const key of ['full_name', 'name'] as const) {
      const value = meta[key];
      if (typeof value === 'string' && value.trim()) {
        name = value.trim();
        break;
      }
    }
  }

  return { email, name };
}

async function meetingActionItemsAlreadyExist(
  admin: SupabaseClient,
  meetingTranscriptId: string,
): Promise<boolean> {
  const { count, error } = await admin
    .from('meeting_action_items')
    .select('id', { count: 'exact', head: true })
    .eq('meeting_transcript_id', meetingTranscriptId);

  if (error) {
    throw new Error(error.message);
  }

  return (count ?? 0) > 0;
}

function mapExtractedItemToRow(
  item: MeetingExtractedActionItem,
  input: MeetingActionItemJobInput,
  members: Awaited<ReturnType<typeof loadAccountMembersForExtraction>>,
  recorderEmail: string,
) {
  return {
    meeting_transcript_id: input.meetingTranscriptId,
    account_id: input.accountId,
    suggested_title: item.suggestedTitle,
    suggested_description: item.suggestedDescription,
    suggested_due_date: item.suggestedDueDate,
    source_excerpt: item.sourceExcerpt,
    assignee_confidence: item.assigneeConfidence,
    suggested_assignee_id: resolveSuggestedAssigneeId(
      {
        suggestedAssigneeEmail: item.suggestedAssigneeEmail,
        assigneeConfidence: item.assigneeConfidence,
      },
      members,
      recorderEmail,
    ),
    status: 'pending_review' as const,
  };
}

export async function extractAndPersistMeetingActionItems(
  admin: SupabaseClient,
  input: MeetingActionItemJobInput,
): Promise<number> {
  if (await meetingActionItemsAlreadyExist(admin, input.meetingTranscriptId)) {
    return 0;
  }

  const recorder = await loadRecorderContext(admin, input.createdByUserId);
  if (!recorder) {
    throw new Error('Could not resolve meeting recorder');
  }

  const members = await loadAccountMembersForExtraction(admin, input.accountId);

  const extracted = await extractMeetingActionItems({
    title: input.title,
    transcript: input.content,
    summaryText: input.summaryText,
    meetingDate: input.meetingDate,
    recorderName: recorder.name,
    recorderEmail: recorder.email,
    accountMembers: members,
    calendarAttendees: input.calendarAttendees,
  });

  const filtered = extracted.filter((item) =>
    shouldIncludeExtractedItem(
      {
        suggestedAssigneeEmail: item.suggestedAssigneeEmail,
        assigneeConfidence: item.assigneeConfidence,
      },
      members,
      recorder.email,
    ),
  );

  if (filtered.length === 0) {
    return 0;
  }

  const rows = filtered.map((item) =>
    mapExtractedItemToRow(item, input, members, recorder.email),
  );

  const { error } = await admin.from('meeting_action_items').insert(rows);

  if (error) {
    throw new Error(error.message);
  }

  return rows.length;
}

export function queueMeetingActionItemExtraction(input: MeetingActionItemJobInput) {
  const admin = getSupabaseServerAdminClient();

  void extractAndPersistMeetingActionItems(admin, input).catch((error) => {
    console.error('[recorder] meeting action item extraction failed', {
      meetingTranscriptId: input.meetingTranscriptId,
      accountId: input.accountId,
      error: error instanceof Error ? error.message : String(error),
    });
  });
}
