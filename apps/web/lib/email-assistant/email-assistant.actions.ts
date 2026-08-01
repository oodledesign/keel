'use server';

import { revalidatePath } from 'next/cache';

import { z } from 'zod';

import { enhanceAction } from '@kit/next/actions';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

import { ignoreEmailThreadNeedsReply } from '~/lib/email-assistant/ignore-thread-needs-reply';

const IgnoreEmailNeedsReplySchema = z.object({
  threadId: z.string().uuid(),
  accountId: z.string().uuid(),
  accountSlug: z.string().min(1).optional(),
});

const SuggestedEmailTaskSchema = z.object({
  actionItemId: z.string().uuid(),
  accountId: z.string().uuid().optional(),
  accountSlug: z.string().min(1).optional(),
});

export const ignoreEmailNeedsReplyAction = enhanceAction(
  async (data, user) => {
    const client = getSupabaseServerClient();
    await ignoreEmailThreadNeedsReply(
      client,
      user.id,
      data.threadId,
      data.accountId,
    );

    revalidatePath('/home/email');
    revalidatePath('/app/email');
    if (data.accountSlug) {
      revalidatePath(`/home/${data.accountSlug}`);
      revalidatePath(`/app/${data.accountSlug}`);
      revalidatePath(`/home/${data.accountSlug}/email`);
      revalidatePath(`/app/${data.accountSlug}/email`);
    }

    return { ok: true as const };
  },
  {
    auth: true,
    schema: IgnoreEmailNeedsReplySchema,
  },
);

export const acceptSuggestedEmailTaskAction = enhanceAction(
  async (data, user) => {
    const client = getSupabaseServerClient();

    const { data: actionItem, error: actionError } = await client
      .from('email_action_items')
      .select(
        'id, title, detail, suggested_due_date, client_id, project_id, status, account_id',
      )
      .eq('id', data.actionItemId)
      .eq('user_id', user.id)
      .maybeSingle();

    if (actionError) {
      throw new Error(actionError.message);
    }

    if (!actionItem || actionItem.status !== 'suggested') {
      throw new Error('This suggestion is no longer available');
    }

    const insertRow: Record<string, unknown> = {
      user_id: user.id,
      title: actionItem.title,
      notes: actionItem.detail,
      due_date: actionItem.suggested_due_date,
      project_id: actionItem.project_id ?? null,
      client_id: actionItem.client_id ?? null,
      account_id: actionItem.account_id ?? data.accountId ?? null,
      status: 'todo',
      priority: 'medium',
      source: 'email',
    };

    let taskResult = await client
      .from('tasks')
      .insert(insertRow)
      .select('id')
      .single();

    if (taskResult.error?.message?.includes('source')) {
      const { source: _source, ...withoutSource } = insertRow;
      void _source;
      taskResult = await client
        .from('tasks')
        .insert(withoutSource)
        .select('id')
        .single();
    }

    if (taskResult.error || !taskResult.data) {
      throw new Error(taskResult.error?.message ?? 'Could not create task');
    }

    const { error: updateError } = await client
      .from('email_action_items')
      .update({
        task_id: (taskResult.data as { id: string }).id,
        status: 'accepted',
      })
      .eq('id', data.actionItemId)
      .eq('user_id', user.id);

    if (updateError) {
      throw new Error(updateError.message);
    }

    revalidateSuggestedEmailPaths(data.accountSlug);
    return {
      ok: true as const,
      taskId: (taskResult.data as { id: string }).id,
    };
  },
  { auth: true, schema: SuggestedEmailTaskSchema },
);

export const dismissSuggestedEmailTaskAction = enhanceAction(
  async (data, user) => {
    const client = getSupabaseServerClient();
    const { error } = await client
      .from('email_action_items')
      .update({ status: 'dismissed' })
      .eq('id', data.actionItemId)
      .eq('user_id', user.id)
      .eq('status', 'suggested');

    if (error) {
      throw new Error(error.message);
    }

    revalidateSuggestedEmailPaths(data.accountSlug);
    return { ok: true as const };
  },
  { auth: true, schema: SuggestedEmailTaskSchema },
);

function revalidateSuggestedEmailPaths(accountSlug?: string) {
  revalidatePath('/home');
  revalidatePath('/app');
  revalidatePath('/home/email');
  revalidatePath('/app/email');
  revalidatePath('/home/email/suggested-tasks');
  revalidatePath('/app/email/suggested-tasks');
  if (accountSlug) {
    revalidatePath(`/home/${accountSlug}`);
    revalidatePath(`/app/${accountSlug}`);
    revalidatePath(`/home/${accountSlug}/email`);
    revalidatePath(`/app/${accountSlug}/email`);
    revalidatePath(`/home/${accountSlug}/email/suggested-tasks`);
    revalidatePath(`/app/${accountSlug}/email/suggested-tasks`);
  }
}
