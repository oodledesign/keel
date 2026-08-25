'use server';

import { revalidatePath } from 'next/cache';

import { z } from 'zod';

import { enhanceAction } from '@kit/next/actions';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

import {
  addEmailTriageRule,
  addEmailTriageRuleFromThread,
  removeEmailTriageRule,
} from '~/lib/email-assistant/email-triage-rules';
import {
  ignoreEmailRuleAndDismissSuggestions,
  removeIgnoredEmailRule,
} from '~/lib/email-assistant/ignored-senders';
import {
  ignoreEmailThreadNeedsReply,
  markEmailThreadNeedsReply,
  setEmailThreadCategory,
} from '~/lib/email-assistant/set-thread-category';
import { buildTaskNotesFromSource } from '~/lib/tasks/build-task-notes-from-source';

import { EMAIL_THREAD_CATEGORIES } from './email-thread-categories';

const IgnoreEmailNeedsReplySchema = z.object({
  threadId: z.string().uuid(),
  accountId: z.string().uuid().optional(),
  accountSlug: z.string().min(1).optional(),
});

const MarkEmailNeedsReplySchema = z.object({
  threadId: z.string().uuid(),
  accountSlug: z.string().min(1).optional(),
});

const SetEmailThreadCategorySchema = z.object({
  threadId: z.string().uuid(),
  category: z.enum(EMAIL_THREAD_CATEGORIES),
  accountSlug: z.string().min(1).optional(),
});

const SetEmailThreadFollowUpSchema = z.object({
  threadId: z.string().uuid(),
  followUpAt: z.string().datetime().nullable(),
  followUpNote: z.string().max(500).nullable().optional(),
  accountSlug: z.string().min(1).optional(),
});

const SuggestedEmailTaskSchema = z.object({
  actionItemId: z.string().uuid(),
  accountId: z.string().uuid().optional(),
  accountSlug: z.string().min(1).optional(),
});

const IgnoreSuggestedEmailRuleSchema = SuggestedEmailTaskSchema.extend({
  scope: z.enum(['sender', 'domain']),
});

const RemoveIgnoredEmailRuleSchema = z.object({
  mailboxKind: z.enum(['business', 'personal']).default('personal'),
  scope: z.enum(['sender', 'domain']),
  value: z.string().min(1).max(320),
});

const EmailTriageActionSchema = z.enum(['ignore', 'priority']);
const EmailTriageScopeSchema = z.enum(['sender', 'domain', 'subject']);

const AddEmailTriageRuleFromThreadSchema = z.object({
  threadId: z.string().uuid(),
  action: EmailTriageActionSchema,
  scope: EmailTriageScopeSchema,
  accountSlug: z.string().min(1).optional(),
});

const AddEmailTriageRuleSchema = z.object({
  mailboxKind: z.enum(['business', 'personal']).default('personal'),
  action: EmailTriageActionSchema,
  scope: EmailTriageScopeSchema,
  value: z.string().min(1).max(320),
});

const RemoveEmailTriageRuleSchema = z.object({
  mailboxKind: z.enum(['business', 'personal']).default('personal'),
  action: EmailTriageActionSchema,
  scope: EmailTriageScopeSchema,
  value: z.string().min(1).max(320),
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

    revalidateNeedsReplyPaths(data.accountSlug);

    return { ok: true as const };
  },
  {
    auth: true,
    schema: IgnoreEmailNeedsReplySchema,
  },
);

export const markEmailNeedsReplyAction = enhanceAction(
  async (data, user) => {
    const client = getSupabaseServerClient();
    await markEmailThreadNeedsReply(client, user.id, data.threadId);

    revalidateNeedsReplyPaths(data.accountSlug);

    return { ok: true as const };
  },
  {
    auth: true,
    schema: MarkEmailNeedsReplySchema,
  },
);

export const setEmailThreadCategoryAction = enhanceAction(
  async (data, user) => {
    const client = getSupabaseServerClient();
    await setEmailThreadCategory(
      client,
      user.id,
      data.threadId,
      data.category,
      'Manually updated category',
      { confidence: 1 },
    );

    revalidateNeedsReplyPaths(data.accountSlug);

    return { ok: true as const, category: data.category };
  },
  {
    auth: true,
    schema: SetEmailThreadCategorySchema,
  },
);

export const setEmailThreadFollowUpAction = enhanceAction(
  async (data, user) => {
    const client = getSupabaseServerClient();

    const { error } = await client
      .from('email_threads')
      .update({
        follow_up_at: data.followUpAt,
        follow_up_note: data.followUpNote?.trim() || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', data.threadId)
      .eq('user_id', user.id);

    if (error) {
      throw new Error(error.message);
    }

    revalidateNeedsReplyPaths(data.accountSlug);

    return { ok: true as const };
  },
  {
    auth: true,
    schema: SetEmailThreadFollowUpSchema,
  },
);

function revalidateNeedsReplyPaths(accountSlug?: string) {
  revalidatePath('/home/email');
  revalidatePath('/app/email');
  revalidatePath('/home');
  revalidatePath('/app');
  if (accountSlug) {
    revalidatePath(`/home/${accountSlug}`);
    revalidatePath(`/app/${accountSlug}`);
    revalidatePath(`/home/${accountSlug}/email`);
    revalidatePath(`/app/${accountSlug}/email`);
  }
}

export const acceptSuggestedEmailTaskAction = enhanceAction(
  async (data, user) => {
    const client = getSupabaseServerClient();

    const { data: actionItem, error: actionError } = await client
      .from('email_action_items')
      .select(
        'id, title, detail, source_excerpt, suggested_due_date, client_id, project_id, status, account_id',
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
      notes: buildTaskNotesFromSource({
        description: actionItem.detail,
        sourceExcerpt: actionItem.source_excerpt,
        sourceLabel: 'Email',
      }),
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

export const ignoreSuggestedEmailSenderAction = enhanceAction(
  async (data, user) => {
    const client = getSupabaseServerClient();
    const result = await ignoreEmailRuleAndDismissSuggestions(
      client,
      user.id,
      data.actionItemId,
      data.scope,
    );

    revalidateSuggestedEmailPaths(data.accountSlug);
    revalidatePath('/home/email');
    revalidatePath('/app/email');

    return {
      ok: true as const,
      scope: result.scope,
      value: result.value,
      sender: result.scope === 'sender' ? result.value : undefined,
      domain: result.scope === 'domain' ? result.value : undefined,
      dismissedCount: result.dismissedCount,
    };
  },
  { auth: true, schema: IgnoreSuggestedEmailRuleSchema },
);

export const removeIgnoredEmailSenderAction = enhanceAction(
  async (data, user) => {
    const client = getSupabaseServerClient();
    const { data: connection, error: connectionError } = await client
      .from('google_connections')
      .select('id')
      .eq('user_id', user.id)
      .eq('mailbox_kind', data.mailboxKind)
      .maybeSingle();

    if (connectionError) {
      throw new Error(connectionError.message);
    }

    const connectionId = (connection as { id?: string } | null)?.id;

    if (!connectionId) {
      throw new Error('Connect Gmail before updating ignored senders');
    }

    const lists = await removeIgnoredEmailRule(
      client,
      user.id,
      connectionId,
      data.scope,
      data.value,
    );

    revalidatePath('/home/email');
    revalidatePath('/app/email');

    return {
      ok: true as const,
      ignoredSenders: lists.senders,
      ignoredDomains: lists.domains,
    };
  },
  { auth: true, schema: RemoveIgnoredEmailRuleSchema },
);

export const addEmailTriageRuleFromThreadAction = enhanceAction(
  async (data, user) => {
    const client = getSupabaseServerClient();
    const result = await addEmailTriageRuleFromThread({
      client,
      userId: user.id,
      threadId: data.threadId,
      action: data.action,
      scope: data.scope,
    });

    revalidateNeedsReplyPaths(data.accountSlug);
    revalidatePath('/home/email');
    revalidatePath('/app/email');

    return {
      ok: true as const,
      action: data.action,
      scope: data.scope,
      value: result.value,
      affectedCount: result.affectedCount,
      rules: result.rules,
    };
  },
  { auth: true, schema: AddEmailTriageRuleFromThreadSchema },
);

export const addEmailTriageRuleAction = enhanceAction(
  async (data, user) => {
    const client = getSupabaseServerClient();
    const { data: connection, error: connectionError } = await client
      .from('google_connections')
      .select('id')
      .eq('user_id', user.id)
      .eq('mailbox_kind', data.mailboxKind)
      .maybeSingle();

    if (connectionError) {
      throw new Error(connectionError.message);
    }

    const connectionId = (connection as { id?: string } | null)?.id;

    if (!connectionId) {
      throw new Error('Connect Gmail before updating triage rules');
    }

    const result = await addEmailTriageRule({
      client,
      userId: user.id,
      connectionId,
      action: data.action,
      scope: data.scope,
      value: data.value,
    });

    revalidatePath('/home/email');
    revalidatePath('/app/email');

    return {
      ok: true as const,
      action: data.action,
      scope: data.scope,
      value: result.value,
      affectedCount: result.affectedCount,
      rules: result.rules,
    };
  },
  { auth: true, schema: AddEmailTriageRuleSchema },
);

export const removeEmailTriageRuleAction = enhanceAction(
  async (data, user) => {
    const client = getSupabaseServerClient();
    const { data: connection, error: connectionError } = await client
      .from('google_connections')
      .select('id')
      .eq('user_id', user.id)
      .eq('mailbox_kind', data.mailboxKind)
      .maybeSingle();

    if (connectionError) {
      throw new Error(connectionError.message);
    }

    const connectionId = (connection as { id?: string } | null)?.id;

    if (!connectionId) {
      throw new Error('Connect Gmail before updating triage rules');
    }

    const rules = await removeEmailTriageRule({
      client,
      userId: user.id,
      connectionId,
      action: data.action,
      scope: data.scope,
      value: data.value,
    });

    revalidatePath('/home/email');
    revalidatePath('/app/email');

    return {
      ok: true as const,
      rules,
    };
  },
  { auth: true, schema: RemoveEmailTriageRuleSchema },
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
