import type {
  BuildRawMessageInput,
  GmailMessage,
  GmailMessagePart,
  ParsedGmailMessage,
} from './types';

export function decodeBase64Url(data: string): string {
  const normalized = data.replace(/-/g, '+').replace(/_/g, '/');
  const pad = normalized.length % 4;
  const padded = pad ? normalized + '='.repeat(4 - pad) : normalized;

  return Buffer.from(padded, 'base64').toString('utf8');
}

export function encodeBase64Url(value: string): string {
  return Buffer.from(value, 'utf8').toString('base64url');
}

function getHeader(
  headers: Array<{ name?: string | null; value?: string | null }> | null | undefined,
  name: string,
): string | null {
  const match = headers?.find(
    (header) => header.name?.toLowerCase() === name.toLowerCase(),
  );

  return match?.value?.trim() || null;
}

function splitAddresses(value: string | null): string[] {
  if (!value?.trim()) {
    return [];
  }

  return value
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
}

function walkParts(
  part: GmailMessagePart | null | undefined,
  acc: { text: string[]; html: string[] },
) {
  if (!part) {
    return;
  }

  if (part.mimeType === 'text/plain' && part.body?.data) {
    acc.text.push(decodeBase64Url(part.body.data));
  }

  if (part.mimeType === 'text/html' && part.body?.data) {
    acc.html.push(decodeBase64Url(part.body.data));
  }

  for (const child of part.parts ?? []) {
    walkParts(child, acc);
  }
}

export function parseMessage(message: GmailMessage): ParsedGmailMessage {
  const headers = message.payload?.headers ?? [];
  const parts = { text: [] as string[], html: [] as string[] };

  if (message.payload?.body?.data && message.payload.mimeType === 'text/plain') {
    parts.text.push(decodeBase64Url(message.payload.body.data));
  } else if (
    message.payload?.body?.data &&
    message.payload.mimeType === 'text/html'
  ) {
    parts.html.push(decodeBase64Url(message.payload.body.data));
  } else {
    walkParts(message.payload, parts);
  }

  const internalDate = message.internalDate
    ? new Date(Number(message.internalDate)).toISOString()
    : null;

  return {
    from: getHeader(headers, 'From'),
    to: splitAddresses(getHeader(headers, 'To')),
    cc: splitAddresses(getHeader(headers, 'Cc')),
    subject: getHeader(headers, 'Subject'),
    bodyText: parts.text.join('\n').trim() || null,
    bodyHtml: parts.html.join('\n').trim() || null,
    internalDate,
  };
}

export function buildRawMessage(input: BuildRawMessageInput): string {
  const lines = [
    input.from ? `From: ${input.from}` : null,
    `To: ${input.to}`,
    `Subject: ${input.subject}`,
    input.inReplyTo ? `In-Reply-To: ${input.inReplyTo}` : null,
    input.references ? `References: ${input.references}` : null,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: 7bit',
    '',
    input.body,
  ].filter((line): line is string => Boolean(line));

  return encodeBase64Url(lines.join('\r\n'));
}

export function participantsFromMessage(message: GmailMessage) {
  const parsed = parseMessage(message);
  const entries = new Map<string, { name: string | null; email: string }>();

  const add = (value: string | null) => {
    if (!value) {
      return;
    }

    const match = value.match(/^(?:"?([^"]*)"?\s)?<?([^>]+@[^>]+)>?$/);

    if (!match) {
      return;
    }

    const email = (match[2] ?? value).trim().toLowerCase();
    const name = match[1]?.trim() || null;
    entries.set(email, { name, email });
  };

  add(parsed.from);
  parsed.to.forEach(add);
  parsed.cc.forEach(add);

  return Array.from(entries.values());
}
