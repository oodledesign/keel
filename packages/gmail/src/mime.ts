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

export function htmlSignatureToPlain(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function normalizePlainTextBody(body: string): string {
  return body.replace(/\r\n/g, '\n').replace(/\n/g, '\r\n');
}

export function stripTrailingPlainSignature(
  body: string,
  plainSignature: string | null | undefined,
): string {
  const sig = plainSignature?.trim();

  if (!sig) {
    return body;
  }

  const normalizedBody = body.replace(/\r\n/g, '\n').trimEnd();
  const normalizedSig = sig.replace(/\r\n/g, '\n');

  if (normalizedBody.endsWith(`\n\n${normalizedSig}`)) {
    return normalizedBody.slice(0, -(normalizedSig.length + 2)).trimEnd();
  }

  if (normalizedBody.endsWith(normalizedSig)) {
    return normalizedBody.slice(0, -normalizedSig.length).trimEnd();
  }

  return body;
}

function plainTextToHtmlContent(body: string): string {
  const normalized = body.replace(/\r\n/g, '\n').trim();
  const escaped = normalized
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  const paragraphs = escaped.split(/\n\n+/);

  return paragraphs
    .map((paragraph) => {
      const lines = paragraph.replace(/\n/g, '<br>');
      return `<p style="margin:0 0 1em 0">${lines}</p>`;
    })
    .join('');
}

export function plainTextToHtml(body: string): string {
  return `<!DOCTYPE html><html><body>${plainTextToHtmlContent(body)}</body></html>`;
}

export function buildHtmlEmailBody(
  body: string,
  options?: {
    signatureHtml?: string | null;
    plainSignature?: string | null;
  },
): string {
  const messageBody = stripTrailingPlainSignature(body, options?.plainSignature);
  const messageHtml = plainTextToHtmlContent(messageBody);
  const signatureHtml = options?.signatureHtml?.trim();

  if (!signatureHtml) {
    return `<!DOCTYPE html><html><body>${messageHtml}</body></html>`;
  }

  return `<!DOCTYPE html><html><body>${messageHtml}<div>${signatureHtml}</div></body></html>`;
}

function createMimeBoundary(): string {
  return `keel_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

export function buildRawMessage(input: BuildRawMessageInput): string {
  const boundary = createMimeBoundary();
  const plainBody = normalizePlainTextBody(input.body);
  const htmlBody = buildHtmlEmailBody(input.body, {
    signatureHtml: input.signatureHtml,
    plainSignature: input.plainSignature,
  });

  const headers = [
    input.from ? `From: ${input.from}` : null,
    `To: ${input.to}`,
    `Subject: ${input.subject}`,
    input.inReplyTo ? `In-Reply-To: ${input.inReplyTo}` : null,
    input.references ? `References: ${input.references}` : null,
    'MIME-Version: 1.0',
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
  ].filter((line): line is string => Boolean(line));

  const mime = [
    ...headers,
    '',
    `--${boundary}`,
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: 7bit',
    '',
    plainBody,
    `--${boundary}`,
    'Content-Type: text/html; charset=UTF-8',
    'Content-Transfer-Encoding: 7bit',
    '',
    htmlBody,
    `--${boundary}--`,
    '',
  ].join('\r\n');

  return encodeBase64Url(mime);
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
