import 'server-only';

import { gmailFetch } from './client';
import { htmlSignatureToPlain } from './mime';

type SendAsEntry = {
  sendAsEmail?: string | null;
  displayName?: string | null;
  signature?: string | null;
  isDefault?: boolean | null;
  isPrimary?: boolean | null;
};

type SendAsListResponse = {
  sendAs?: SendAsEntry[];
};

export type ResolvedEmailSignature = {
  plain: string | null;
  html: string | null;
};

function looksLikeHtmlSignature(value: string): boolean {
  return /<[a-z][\s\S]*>/i.test(value);
}

function resolveSignatureContent(
  raw: string | null | undefined,
): ResolvedEmailSignature {
  const trimmed = raw?.trim();

  if (!trimmed) {
    return { plain: null, html: null };
  }

  if (looksLikeHtmlSignature(trimmed)) {
    return {
      plain: htmlSignatureToPlain(trimmed) || null,
      html: trimmed,
    };
  }

  return { plain: trimmed, html: null };
}

/** Default Gmail "Send mail as" signature (requires gmail.settings.basic scope). */
export async function getGmailDefaultSignature(
  userId: string,
): Promise<ResolvedEmailSignature> {
  const response = await gmailFetch<SendAsListResponse>(
    userId,
    '/settings/sendAs',
  );

  const entries = response.sendAs ?? [];
  const preferred =
    entries.find((entry) => entry.isDefault) ??
    entries.find((entry) => entry.isPrimary) ??
    entries[0];

  return resolveSignatureContent(preferred?.signature);
}

export async function getGmailDefaultSendAs(
  userId: string,
): Promise<{ email: string; displayName: string | null } | null> {
  const response = await gmailFetch<SendAsListResponse>(
    userId,
    '/settings/sendAs',
  );

  const entries = response.sendAs ?? [];
  const preferred =
    entries.find((entry) => entry.isDefault) ??
    entries.find((entry) => entry.isPrimary) ??
    entries[0];

  const email = preferred?.sendAsEmail?.trim();

  if (!email) {
    return null;
  }

  return {
    email,
    displayName: preferred?.displayName?.trim() || null,
  };
}
