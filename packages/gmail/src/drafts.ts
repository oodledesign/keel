import 'server-only';

import type { GoogleMailboxScope, MailboxKind } from '@kit/google-auth';

import { gmailFetch } from './client';

type CreateDraftInput = {
  threadId: string;
  raw: string;
};

type GmailDraftResponse = {
  id?: string | null;
  message?: {
    id?: string | null;
    threadId?: string | null;
  } | null;
};

export async function createDraft(
  userId: string,
  input: CreateDraftInput,
  mailboxKind: MailboxKind = 'business',
  scope?: GoogleMailboxScope,
): Promise<GmailDraftResponse> {
  return gmailFetch<GmailDraftResponse>(
    userId,
    '/drafts',
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        message: {
          raw: input.raw,
          threadId: input.threadId,
        },
      }),
    },
    mailboxKind,
    scope,
  );
}

export async function updateDraft(
  userId: string,
  draftId: string,
  raw: string,
  mailboxKind: MailboxKind = 'business',
  scope?: GoogleMailboxScope,
): Promise<GmailDraftResponse> {
  return gmailFetch<GmailDraftResponse>(
    userId,
    `/drafts/${encodeURIComponent(draftId)}`,
    {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        message: {
          raw,
        },
      }),
    },
    mailboxKind,
    scope,
  );
}

export async function sendDraft(
  userId: string,
  draftId: string,
  mailboxKind: MailboxKind = 'business',
  scope?: GoogleMailboxScope,
): Promise<GmailDraftResponse> {
  return gmailFetch<GmailDraftResponse>(
    userId,
    `/drafts/${encodeURIComponent(draftId)}/send`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({}),
    },
    mailboxKind,
    scope,
  );
}
