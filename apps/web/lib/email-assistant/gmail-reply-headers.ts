import { gmailFetch } from '@kit/gmail/client';
import type { MailboxKind } from '@kit/google-auth';

type GmailMetadataMessage = {
  payload?: {
    headers?: Array<{ name?: string | null; value?: string | null }> | null;
  } | null;
};

function getHeader(message: GmailMetadataMessage, name: string): string | null {
  const headers = message.payload?.headers ?? [];
  const match = headers.find(
    (header) => header.name?.toLowerCase() === name.toLowerCase(),
  );

  return match?.value?.trim() || null;
}

export async function loadGmailReplyHeaders(
  userId: string,
  gmailMessageId: string,
  mailboxKind: MailboxKind = 'business',
) {
  const message = await gmailFetch<GmailMetadataMessage>(
    userId,
    `/messages/${encodeURIComponent(gmailMessageId)}?format=metadata&metadataHeaders=Message-Id&metadataHeaders=References&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=To&metadataHeaders=Cc`,
    undefined,
    mailboxKind,
  );

  return {
    messageId: getHeader(message, 'Message-Id'),
    references: getHeader(message, 'References'),
    subject: getHeader(message, 'Subject'),
    from: getHeader(message, 'From'),
    to: getHeader(message, 'To'),
    cc: getHeader(message, 'Cc'),
  };
}
