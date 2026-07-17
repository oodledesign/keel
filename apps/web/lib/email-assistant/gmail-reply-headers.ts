import { gmailFetch } from '@kit/gmail/client';

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
) {
  const message = await gmailFetch<GmailMetadataMessage>(
    userId,
    `/messages/${encodeURIComponent(gmailMessageId)}?format=metadata&metadataHeaders=Message-Id&metadataHeaders=References&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=To`,
  );

  return {
    messageId: getHeader(message, 'Message-Id'),
    references: getHeader(message, 'References'),
    subject: getHeader(message, 'Subject'),
    from: getHeader(message, 'From'),
    to: getHeader(message, 'To'),
  };
}
