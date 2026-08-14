import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import { extractEmailAddress } from './address-utils';
import {
  type EmailTriageAction,
  type EmailTriageMatch,
  type EmailTriageRules,
  type EmailTriageScope,
  normalizeSubjectKeywords,
  subjectKeywordFromThreadSubject,
  subjectMatchesKeyword,
} from './email-triage-rules.shared';
import {
  type EmailIgnoreLists,
  type IgnoreEmailScope,
  extractEmailDomain,
  ignoreEmailRuleAndDismissSuggestions,
  isAddressIgnored,
  normalizeIgnoredDomains,
  normalizeIgnoredSenders,
  removeIgnoredEmailRule,
} from './ignored-senders';

export type {
  EmailTriageAction,
  EmailTriageMatch,
  EmailTriageRules,
  EmailTriageScope,
};
export {
  normalizeSubjectKeywords,
  subjectKeywordFromThreadSubject,
  subjectMatchesKeyword,
};
export {
  extractEmailDomain,
  ignoreEmailRuleAndDismissSuggestions,
  isAddressIgnored,
  normalizeIgnoredDomains,
  normalizeIgnoredSenders,
  removeIgnoredEmailRule,
};
export type { EmailIgnoreLists, IgnoreEmailScope };

export function emptyEmailTriageRules(): EmailTriageRules {
  return {
    ignoredSenders: [],
    ignoredDomains: [],
    ignoredSubjectKeywords: [],
    prioritySenders: [],
    priorityDomains: [],
    prioritySubjectKeywords: [],
  };
}

export function normalizeEmailTriageRules(
  raw: Partial<{
    ignored_senders: string[] | null;
    ignored_domains: string[] | null;
    ignored_subject_keywords: string[] | null;
    priority_senders: string[] | null;
    priority_domains: string[] | null;
    priority_subject_keywords: string[] | null;
  }> | null,
): EmailTriageRules {
  return {
    ignoredSenders: normalizeIgnoredSenders(raw?.ignored_senders ?? []),
    ignoredDomains: normalizeIgnoredDomains(raw?.ignored_domains ?? []),
    ignoredSubjectKeywords: normalizeSubjectKeywords(
      raw?.ignored_subject_keywords ?? [],
    ),
    prioritySenders: normalizeIgnoredSenders(raw?.priority_senders ?? []),
    priorityDomains: normalizeIgnoredDomains(raw?.priority_domains ?? []),
    prioritySubjectKeywords: normalizeSubjectKeywords(
      raw?.priority_subject_keywords ?? [],
    ),
  };
}

/**
 * Resolve the strongest triage rule for a message tip.
 * Ignore wins over priority when both match.
 */
export function matchEmailTriageRule(
  input: {
    fromAddress: string | null | undefined;
    subject: string | null | undefined;
  },
  rules: EmailTriageRules,
): EmailTriageMatch | null {
  if (
    isAddressIgnored(input.fromAddress, {
      senders: rules.ignoredSenders,
      domains: rules.ignoredDomains,
    })
  ) {
    const email = extractEmailAddress(input.fromAddress);
    const domain = extractEmailDomain(input.fromAddress);
    const isSender = Boolean(
      email &&
      rules.ignoredSenders.some((s) => extractEmailAddress(s) === email),
    );
    const value = isSender ? (email ?? 'unknown') : (domain ?? 'unknown');
    return {
      action: 'ignore',
      scope: isSender ? 'sender' : 'domain',
      value,
      reason: isSender
        ? `Sender ignored (${value})`
        : `Domain ignored (${value})`,
    };
  }

  const ignoredSubject = subjectMatchesKeyword(
    input.subject,
    rules.ignoredSubjectKeywords,
  );
  if (ignoredSubject) {
    return {
      action: 'ignore',
      scope: 'subject',
      value: ignoredSubject,
      reason: `Subject ignored (“${ignoredSubject}”)`,
    };
  }

  const from = extractEmailAddress(input.fromAddress);
  if (
    from &&
    rules.prioritySenders.some((s) => extractEmailAddress(s) === from)
  ) {
    return {
      action: 'priority',
      scope: 'sender',
      value: from,
      reason: `Priority sender (${from})`,
    };
  }

  const domain = extractEmailDomain(input.fromAddress);
  if (
    domain &&
    rules.priorityDomains.some(
      (d) => normalizeIgnoredDomains([d])[0] === domain,
    )
  ) {
    return {
      action: 'priority',
      scope: 'domain',
      value: domain,
      reason: `Priority domain (${domain})`,
    };
  }

  const prioritySubject = subjectMatchesKeyword(
    input.subject,
    rules.prioritySubjectKeywords,
  );
  if (prioritySubject) {
    return {
      action: 'priority',
      scope: 'subject',
      value: prioritySubject,
      reason: `Priority subject (“${prioritySubject}”)`,
    };
  }

  return null;
}

async function loadRulesForConnection(
  client: SupabaseClient,
  userId: string,
  connectionId: string,
): Promise<EmailTriageRules> {
  const { data, error } = await client
    .from('email_assistant_settings')
    .select(
      'ignored_senders, ignored_domains, ignored_subject_keywords, priority_senders, priority_domains, priority_subject_keywords',
    )
    .eq('connection_id', connectionId)
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return normalizeEmailTriageRules(
    data as Parameters<typeof normalizeEmailTriageRules>[0],
  );
}

async function persistRules(
  client: SupabaseClient,
  userId: string,
  connectionId: string,
  rules: EmailTriageRules,
): Promise<EmailTriageRules> {
  const { error } = await client.from('email_assistant_settings').upsert(
    {
      user_id: userId,
      connection_id: connectionId,
      ignored_senders: rules.ignoredSenders,
      ignored_domains: rules.ignoredDomains,
      ignored_subject_keywords: rules.ignoredSubjectKeywords,
      priority_senders: rules.prioritySenders,
      priority_domains: rules.priorityDomains,
      priority_subject_keywords: rules.prioritySubjectKeywords,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'connection_id' },
  );

  if (error) {
    throw new Error(error.message);
  }

  return rules;
}

function withAddedRule(
  rules: EmailTriageRules,
  action: EmailTriageAction,
  scope: EmailTriageScope,
  value: string,
): EmailTriageRules {
  const next = { ...rules };

  if (action === 'ignore') {
    if (scope === 'sender') {
      next.ignoredSenders = normalizeIgnoredSenders([
        ...rules.ignoredSenders,
        value,
      ]);
    } else if (scope === 'domain') {
      next.ignoredDomains = normalizeIgnoredDomains([
        ...rules.ignoredDomains,
        value,
      ]);
    } else {
      next.ignoredSubjectKeywords = normalizeSubjectKeywords([
        ...rules.ignoredSubjectKeywords,
        value,
      ]);
    }
  } else if (scope === 'sender') {
    next.prioritySenders = normalizeIgnoredSenders([
      ...rules.prioritySenders,
      value,
    ]);
  } else if (scope === 'domain') {
    next.priorityDomains = normalizeIgnoredDomains([
      ...rules.priorityDomains,
      value,
    ]);
  } else {
    next.prioritySubjectKeywords = normalizeSubjectKeywords([
      ...rules.prioritySubjectKeywords,
      value,
    ]);
  }

  return next;
}

function withRemovedRule(
  rules: EmailTriageRules,
  action: EmailTriageAction,
  scope: EmailTriageScope,
  value: string,
): EmailTriageRules {
  const next = { ...rules };

  if (action === 'ignore') {
    if (scope === 'sender') {
      const normalized = extractEmailAddress(value);
      if (!normalized) throw new Error('Invalid email address');
      next.ignoredSenders = rules.ignoredSenders.filter(
        (s) => s !== normalized,
      );
    } else if (scope === 'domain') {
      const normalized = normalizeIgnoredDomains([value])[0];
      if (!normalized) throw new Error('Invalid domain');
      next.ignoredDomains = rules.ignoredDomains.filter(
        (d) => d !== normalized,
      );
    } else {
      const normalized = normalizeSubjectKeywords([value])[0];
      if (!normalized) throw new Error('Invalid subject keyword');
      next.ignoredSubjectKeywords = rules.ignoredSubjectKeywords.filter(
        (k) => k.toLowerCase() !== normalized.toLowerCase(),
      );
    }
  } else if (scope === 'sender') {
    const normalized = extractEmailAddress(value);
    if (!normalized) throw new Error('Invalid email address');
    next.prioritySenders = rules.prioritySenders.filter(
      (s) => s !== normalized,
    );
  } else if (scope === 'domain') {
    const normalized = normalizeIgnoredDomains([value])[0];
    if (!normalized) throw new Error('Invalid domain');
    next.priorityDomains = rules.priorityDomains.filter(
      (d) => d !== normalized,
    );
  } else {
    const normalized = normalizeSubjectKeywords([value])[0];
    if (!normalized) throw new Error('Invalid subject keyword');
    next.prioritySubjectKeywords = rules.prioritySubjectKeywords.filter(
      (k) => k.toLowerCase() !== normalized.toLowerCase(),
    );
  }

  return next;
}

async function applyRuleToMatchingThreads(
  client: SupabaseClient,
  userId: string,
  connectionId: string,
  action: EmailTriageAction,
  scope: EmailTriageScope,
  value: string,
): Promise<number> {
  const { data: threads, error: threadsError } = await client
    .from('email_threads')
    .select('id')
    .eq('user_id', userId)
    .eq('connection_id', connectionId)
    .order('last_message_at', { ascending: false, nullsFirst: false })
    .limit(500);

  if (threadsError) {
    throw new Error(threadsError.message);
  }

  const threadIds = (threads ?? []).map((row) => String(row.id));
  if (threadIds.length === 0) return 0;

  const tipByThread = new Map<
    string,
    { from_address: string | null; subject: string | null }
  >();

  for (const chunk of chunkIds(threadIds, 80)) {
    const { data: tips, error: tipsError } = await client
      .from('email_messages')
      .select('thread_id, from_address, subject')
      .eq('user_id', userId)
      .in('thread_id', chunk)
      .order('internal_date', { ascending: false, nullsFirst: false });

    if (tipsError) {
      throw new Error(tipsError.message);
    }

    for (const tip of tips ?? []) {
      const threadId = String(tip.thread_id);
      if (tipByThread.has(threadId)) continue;
      tipByThread.set(threadId, {
        from_address: (tip.from_address as string | null) ?? null,
        subject: (tip.subject as string | null) ?? null,
      });
    }
  }

  const probeRules = withAddedRule(
    emptyEmailTriageRules(),
    action,
    scope,
    value,
  );
  const matching: string[] = [];

  for (const [threadId, tip] of tipByThread) {
    const match = matchEmailTriageRule(
      {
        fromAddress: tip.from_address,
        subject: tip.subject,
      },
      probeRules,
    );
    if (match) matching.push(threadId);
  }

  if (matching.length === 0) return 0;

  const category = action === 'ignore' ? 'no_reply' : 'needs_reply';
  const reason =
    action === 'ignore'
      ? scope === 'subject'
        ? `Subject ignored (“${value}”)`
        : scope === 'domain'
          ? `Domain ignored (${value})`
          : `Sender ignored (${value})`
      : scope === 'subject'
        ? `Priority subject (“${value}”)`
        : scope === 'domain'
          ? `Priority domain (${value})`
          : `Priority sender (${value})`;

  for (const chunk of chunkIds(matching, 80)) {
    const { error: updateError } = await client
      .from('email_threads')
      .update({
        assistant_category: category,
        assistant_category_reason: reason,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId)
      .in('id', chunk);

    if (updateError) {
      throw new Error(updateError.message);
    }
  }

  if (action === 'ignore') {
    for (const chunk of chunkIds(matching, 80)) {
      const { error: dismissError } = await client
        .from('email_action_items')
        .update({ status: 'dismissed' })
        .eq('user_id', userId)
        .eq('status', 'suggested')
        .in('thread_id', chunk);

      if (dismissError) {
        throw new Error(dismissError.message);
      }
    }
  }

  return matching.length;
}

function chunkIds(ids: string[], size: number): string[][] {
  if (ids.length === 0) return [];
  const chunks: string[][] = [];
  for (let i = 0; i < ids.length; i += size) {
    chunks.push(ids.slice(i, i + size));
  }
  return chunks;
}

export async function addEmailTriageRule(params: {
  client: SupabaseClient;
  userId: string;
  connectionId: string;
  action: EmailTriageAction;
  scope: EmailTriageScope;
  value: string;
}): Promise<{ rules: EmailTriageRules; value: string; affectedCount: number }> {
  let normalized: string | null = null;

  if (params.scope === 'sender') {
    normalized = extractEmailAddress(params.value);
    if (!normalized) throw new Error('Invalid email address');
  } else if (params.scope === 'domain') {
    normalized = normalizeIgnoredDomains([params.value])[0] ?? null;
    if (!normalized) throw new Error('Invalid domain');
  } else {
    normalized = normalizeSubjectKeywords([params.value])[0] ?? null;
    if (!normalized) throw new Error('Enter at least 2 characters for subject');
  }

  const current = await loadRulesForConnection(
    params.client,
    params.userId,
    params.connectionId,
  );
  const next = withAddedRule(current, params.action, params.scope, normalized!);
  const rules = await persistRules(
    params.client,
    params.userId,
    params.connectionId,
    next,
  );
  const affectedCount = await applyRuleToMatchingThreads(
    params.client,
    params.userId,
    params.connectionId,
    params.action,
    params.scope,
    normalized!,
  );

  return { rules, value: normalized!, affectedCount };
}

export async function removeEmailTriageRule(params: {
  client: SupabaseClient;
  userId: string;
  connectionId: string;
  action: EmailTriageAction;
  scope: EmailTriageScope;
  value: string;
}): Promise<EmailTriageRules> {
  const current = await loadRulesForConnection(
    params.client,
    params.userId,
    params.connectionId,
  );
  const next = withRemovedRule(
    current,
    params.action,
    params.scope,
    params.value,
  );
  return persistRules(params.client, params.userId, params.connectionId, next);
}

export async function addEmailTriageRuleFromThread(params: {
  client: SupabaseClient;
  userId: string;
  threadId: string;
  action: EmailTriageAction;
  scope: EmailTriageScope;
}): Promise<{
  rules: EmailTriageRules;
  value: string;
  affectedCount: number;
  connectionId: string;
}> {
  const { data: thread, error: threadError } = await params.client
    .from('email_threads')
    .select('id, connection_id, subject')
    .eq('id', params.threadId)
    .eq('user_id', params.userId)
    .maybeSingle();

  if (threadError) throw new Error(threadError.message);
  if (!thread) throw new Error('Thread not found');

  const connectionId = thread.connection_id as string;
  if (!connectionId) throw new Error('Thread is missing a mailbox connection');

  const { data: latest, error: latestError } = await params.client
    .from('email_messages')
    .select('from_address, subject')
    .eq('thread_id', params.threadId)
    .eq('user_id', params.userId)
    .order('internal_date', { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle();

  if (latestError) throw new Error(latestError.message);

  const fromAddress =
    (latest as { from_address?: string | null } | null)?.from_address ?? null;
  const subject =
    (latest as { subject?: string | null } | null)?.subject ??
    (thread.subject as string | null) ??
    null;

  let value: string | null = null;
  if (params.scope === 'sender') {
    value = extractEmailAddress(fromAddress);
    if (!value) throw new Error('Could not determine the sender address');
  } else if (params.scope === 'domain') {
    value = extractEmailDomain(fromAddress);
    if (!value) throw new Error('Could not determine the sender domain');
  } else {
    value = subjectKeywordFromThreadSubject(subject);
    if (!value) throw new Error('Could not determine a subject keyword');
  }

  const result = await addEmailTriageRule({
    client: params.client,
    userId: params.userId,
    connectionId,
    action: params.action,
    scope: params.scope,
    value,
  });

  return { ...result, connectionId };
}
