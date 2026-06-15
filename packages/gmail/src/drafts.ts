import 'server-only';

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
): Promise<GmailDraftResponse> {
  return gmailFetch<GmailDraftResponse>(userId, '/drafts', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      message: {
        raw: input.raw,
        threadId: input.threadId,
      },
    }),
  });
}

export async function updateDraft(
  userId: string,
  draftId: string,
  raw: string,
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
  );
}
