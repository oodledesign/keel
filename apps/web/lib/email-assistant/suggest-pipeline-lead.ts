import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import { detectPipelineLead } from '@kit/email-assistant';

import { normalizeImportName } from '~/lib/clients/client-import';
import { findPipelineDuplicate } from '~/lib/integrations/linkedin/linkedin-import';

import { extractEmailAddress, isFromOwner } from './address-utils';
import { resolveDraftOwnerContext } from './draft-owner';
import { isActionableEmailCategory } from './email-thread-categories';
import { createMeteredEmailGenerateText } from './metered-generate-text';
import { buildThreadText } from './thread-text';

export type PipelineLeadSuggestion = {
  accountId: string;
  contactName: string;
  companyName: string;
  contactEmail: string | null;
  description: string | null;
};

const SUGGEST_CONFIDENCE_THRESHOLD = 0.65;

function participantEmails(
  participants: unknown,
  ownerEmail: string,
): string[] {
  if (!Array.isArray(participants)) {
    return [];
  }

  const owner = extractEmailAddress(ownerEmail);
  const emails = new Set<string>();

  for (const entry of participants) {
    if (!entry || typeof entry !== 'object') {
      continue;
    }

    const row = entry as { email?: string | null };
    const email = extractEmailAddress(row.email);

    if (!email || (owner && email === owner)) {
      continue;
    }

    emails.add(email);
  }

  return [...emails];
}

async function hasMatchingClient(
  admin: SupabaseClient,
  accountId: string,
  emails: string[],
  contactName: string | null,
  companyName: string | null,
): Promise<boolean> {
  if (emails.length > 0) {
    const { data: clients } = await admin
      .from('clients')
      .select('id, email')
      .eq('account_id', accountId);

    for (const row of clients ?? []) {
      const email = extractEmailAddress(row.email as string | null);
      if (email && emails.includes(email)) {
        return true;
      }
    }
  }

  const duplicate = findPipelineDuplicate(
    {
      rowIndex: 0,
      contactName: contactName ?? '',
      companyName: companyName ?? '',
      position: null,
      email: emails[0] ?? null,
      connectedOn: null,
      errors: [],
      warnings: [],
    },
    (
      await admin
        .from('pipeline_deals')
        .select('id, contact_name, company_name')
        .eq('account_id', accountId)
        .limit(500)
    ).data?.map((row) => ({
      id: row.id as string,
      contactName: row.contact_name as string | null,
      companyName: row.company_name as string | null,
    })) ?? [],
  );

  return Boolean(duplicate);
}

export async function suggestPipelineLeadForThread(
  admin: SupabaseClient,
  params: {
    userId: string;
    threadId: string;
    preferredAccountId?: string | null;
    billingAccountId?: string | null;
    mailboxKind?: 'business' | 'personal';
  },
): Promise<PipelineLeadSuggestion | null> {
  if (params.mailboxKind === 'personal') {
    return null;
  }

  const { data: thread, error } = await admin
    .from('email_threads')
    .select(
      'id, user_id, subject, snippet, participants, assistant_category, account_id, client_id, pipeline_deal_id, link_source',
    )
    .eq('id', params.threadId)
    .eq('user_id', params.userId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!thread) {
    return null;
  }

  if (thread.client_id || thread.pipeline_deal_id) {
    return null;
  }

  if (!isActionableEmailCategory(thread.assistant_category as string | null)) {
    return null;
  }

  const accountId =
    (thread.account_id as string | null) ??
    params.preferredAccountId?.trim() ??
    null;

  if (!accountId) {
    return null;
  }

  const owner = await resolveDraftOwnerContext(params.userId);
  if (!owner) {
    return null;
  }

  const emails = participantEmails(thread.participants, owner.email);
  if (emails.length === 0) {
    return null;
  }

  const { data: messages, error: messagesError } = await admin
    .from('email_messages')
    .select(
      'id, from_address, subject, body_text, snippet, internal_date, created_at',
    )
    .eq('thread_id', params.threadId)
    .eq('user_id', params.userId)
    .order('internal_date', { ascending: true, nullsFirst: false });

  if (messagesError) {
    throw new Error(messagesError.message);
  }

  const latest = messages?.at(-1);
  if (
    latest &&
    isFromOwner(latest.from_address as string | null, owner.email)
  ) {
    return null;
  }

  const threadText = buildThreadText((messages ?? []) as never[]);
  if (!threadText.trim()) {
    return null;
  }

  const detection = await detectPipelineLead(
    threadText,
    owner,
    createMeteredEmailGenerateText({
      feature: 'email_triage',
      accountId: params.billingAccountId ?? accountId,
      supabase: admin,
    }),
  );

  if (!detection.isLead) {
    await admin
      .from('email_threads')
      .update({
        pipeline_lead_suggestion: null,
        pipeline_lead_confidence: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', params.threadId)
      .eq('user_id', params.userId);
    return null;
  }

  const confidence = detection.confidence ?? 0;
  if (confidence < SUGGEST_CONFIDENCE_THRESHOLD) {
    return null;
  }

  const contactName =
    detection.contactName?.trim() ||
    (() => {
      if (!Array.isArray(thread.participants)) return null;
      const first = thread.participants[0];
      if (!first || typeof first !== 'object') return null;
      const name = (first as { name?: string | null }).name;
      return name?.trim() || null;
    })() ||
    'Unknown contact';
  const companyName =
    detection.companyName?.trim() ||
    normalizeImportName(contactName) ||
    'Unknown company';
  const contactEmail = detection.contactEmail ?? emails[0] ?? null;

  const duplicate = await hasMatchingClient(
    admin,
    accountId,
    emails,
    contactName,
    companyName,
  );

  if (duplicate) {
    return null;
  }

  const suggestion: PipelineLeadSuggestion = {
    accountId,
    contactName,
    companyName,
    contactEmail,
    description: detection.description,
  };

  await admin
    .from('email_threads')
    .update({
      pipeline_lead_suggestion: suggestion,
      pipeline_lead_confidence: confidence,
      updated_at: new Date().toISOString(),
    })
    .eq('id', params.threadId)
    .eq('user_id', params.userId);

  return suggestion;
}
