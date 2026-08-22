import type {
  EmailParticipant,
  EmailThreadSummary,
} from '~/home/(user)/email/_lib/types';

import {
  type EmailThreadCategory,
  normalizeEmailThreadCategory,
} from './email-thread-categories';
import { mapThreadLinkFields } from './thread-link-display';

export function parseEmailParticipants(value: unknown): EmailParticipant[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => {
      if (!entry || typeof entry !== 'object') {
        return null;
      }

      const row = entry as { name?: unknown; email?: unknown };
      const email = typeof row.email === 'string' ? row.email.trim() : '';

      if (!email) {
        return null;
      }

      return {
        name: typeof row.name === 'string' ? row.name : null,
        email,
      };
    })
    .filter((entry): entry is EmailParticipant => entry !== null);
}

export function mapEmailThreadRow(
  row: Record<string, unknown>,
): EmailThreadSummary {
  const category = normalizeEmailThreadCategory(
    row.assistant_category as string | null | undefined,
  );

  return {
    id: String(row.id),
    gmail_thread_id: String(row.gmail_thread_id),
    subject: (row.subject as string | null) ?? null,
    snippet: (row.snippet as string | null) ?? null,
    participants: parseEmailParticipants(row.participants),
    is_unread: Boolean(row.is_unread),
    last_message_at: (row.last_message_at as string | null) ?? null,
    assistant_category: category,
    assistant_category_reason:
      (row.assistant_category_reason as string | null) ?? null,
    assistant_category_confidence:
      typeof row.assistant_category_confidence === 'number'
        ? row.assistant_category_confidence
        : null,
    follow_up_at: (row.follow_up_at as string | null) ?? null,
    follow_up_note: (row.follow_up_note as string | null) ?? null,
    link: mapThreadLinkFields(row),
    link_confidence:
      typeof row.link_confidence === 'number' ? row.link_confidence : null,
    link_suggestion: parseLinkSuggestion(row.link_suggestion),
    pipeline_lead_suggestion: parsePipelineLeadSuggestion(
      row.pipeline_lead_suggestion,
    ),
    pipeline_lead_confidence:
      typeof row.pipeline_lead_confidence === 'number'
        ? row.pipeline_lead_confidence
        : null,
    pipeline_deal_id:
      typeof row.pipeline_deal_id === 'string' ? row.pipeline_deal_id : null,
  };
}

function parsePipelineLeadSuggestion(
  value: unknown,
): EmailThreadSummary['pipeline_lead_suggestion'] {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const row = value as Record<string, unknown>;
  const accountId =
    typeof row.accountId === 'string'
      ? row.accountId
      : typeof row.account_id === 'string'
        ? row.account_id
        : null;
  const contactName =
    typeof row.contactName === 'string'
      ? row.contactName
      : typeof row.contact_name === 'string'
        ? row.contact_name
        : null;
  const companyName =
    typeof row.companyName === 'string'
      ? row.companyName
      : typeof row.company_name === 'string'
        ? row.company_name
        : null;

  if (!accountId || !contactName || !companyName) {
    return null;
  }

  return {
    accountId,
    contactName,
    companyName,
    contactEmail:
      typeof row.contactEmail === 'string'
        ? row.contactEmail
        : typeof row.contact_email === 'string'
          ? row.contact_email
          : null,
    description:
      typeof row.description === 'string' ? row.description : null,
  };
}

function parseLinkSuggestion(value: unknown): EmailThreadSummary['link_suggestion'] {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const row = value as Record<string, unknown>;
  const accountId =
    typeof row.accountId === 'string'
      ? row.accountId
      : typeof row.account_id === 'string'
        ? row.account_id
        : null;
  const clientId =
    typeof row.clientId === 'string'
      ? row.clientId
      : typeof row.client_id === 'string'
        ? row.client_id
        : null;
  const projectId =
    typeof row.projectId === 'string'
      ? row.projectId
      : typeof row.project_id === 'string'
        ? row.project_id
        : null;

  if (!accountId && !clientId && !projectId) {
    return null;
  }

  return {
    accountId,
    clientId,
    projectId,
    clientName:
      typeof row.clientName === 'string'
        ? row.clientName
        : typeof row.client_name === 'string'
          ? row.client_name
          : null,
    projectName:
      typeof row.projectName === 'string'
        ? row.projectName
        : typeof row.project_name === 'string'
          ? row.project_name
          : null,
  };
}

export function isActionableCategoryFilter(
  category: EmailThreadCategory | null,
): boolean {
  return category === 'reply_now' || category === 'reply_later';
}
