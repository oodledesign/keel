import 'server-only';

import { z } from 'zod';

import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

import pathsConfig from '~/config/paths.config';
import { workAccountPath } from '~/home/[account]/_lib/work-account-path';
import { extractWorkspaceTasksWithAnthropic } from '~/lib/ai/workspace-task-extract';
import { assertWorkspaceMember } from '~/lib/api-tokens/assert-workspace-member';
import { ExtensionSpeakerEventSchema } from '~/lib/extension/speaker-events';
import { appendSpeakerTimeline } from '~/lib/extension/speaker-timeline';
import { createRecorderNote } from '~/lib/recorder/create-note';
import { createRecorderTask } from '~/lib/recorder/create-task';

export const ExtensionExtractTasksSchema = z.object({
  account_id: z.string().uuid(),
  title: z.string().trim().max(200).optional(),
  content: z.string().trim().min(20).max(80_000),
  create_tasks: z.boolean().optional(),
  create_note: z.boolean().optional(),
  events: z.array(ExtensionSpeakerEventSchema).max(200).optional(),
});

export type ExtensionExtractTasksInput = z.infer<
  typeof ExtensionExtractTasksSchema
>;

export async function extractTasksFromExtensionText(input: {
  userId: string;
  body: ExtensionExtractTasksInput;
}): Promise<{
  note_id: string | null;
  detail_path: string | null;
  extract_path: string | null;
  drafts: Array<{ title: string; notes: string | null }>;
  created_task_ids: string[];
}> {
  const admin = getSupabaseServerAdminClient();
  await assertWorkspaceMember(admin, input.body.account_id, input.userId);

  const content = appendSpeakerTimeline(
    input.body.content,
    input.body.events ?? [],
  );
  const createNote = input.body.create_note !== false;

  let noteId: string | null = null;
  let detailPath: string | null = null;
  if (createNote) {
    const note = await createRecorderNote({
      userId: input.userId,
      accountId: input.body.account_id,
      title: input.body.title?.trim() || 'Meet transcript',
      content,
      category: 'meeting_transcript',
      source: 'chrome_extension',
    });
    noteId = note.id;
    detailPath = note.detail_path;
  }

  const { data: account } = await admin
    .from('accounts')
    .select('slug')
    .eq('id', input.body.account_id)
    .maybeSingle();
  const slug = (account?.slug as string | null)?.trim() || null;
  const extractPath = slug
    ? workAccountPath(pathsConfig.app.accountTasksExtract, slug)
    : null;

  const drafts = await extractWorkspaceTasksWithAnthropic(
    content,
    { projects: [], clients: [] },
    null,
    { accountId: input.body.account_id, supabase: admin },
  );

  const createdTaskIds: string[] = [];
  if (input.body.create_tasks) {
    for (const draft of drafts) {
      const result = await createRecorderTask({
        userId: input.userId,
        accountId: input.body.account_id,
        title: draft.title,
        notes: draft.notes,
        dueDate: draft.dueDate,
        durationMinutes: draft.durationMinutes,
        priority: draft.priority,
      });
      createdTaskIds.push(result.id);
    }
  }

  return {
    note_id: noteId,
    detail_path: detailPath,
    extract_path: extractPath,
    drafts: drafts.map((draft) => ({
      title: draft.title,
      notes: draft.notes,
    })),
    created_task_ids: createdTaskIds,
  };
}
