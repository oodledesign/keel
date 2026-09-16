import 'server-only';

import { GmailApiError, htmlSignatureToPlain } from '@kit/gmail';
import {
  type ResolvedEmailSignature,
  getGmailDefaultSignature,
} from '@kit/gmail/send-as';
import type { GoogleMailboxScope, MailboxKind } from '@kit/google-auth';

export type { ResolvedEmailSignature };

function parseSettingsSignature(
  value: string | null | undefined,
  signatureIsHtml: boolean,
): ResolvedEmailSignature {
  const trimmed = value?.trim();

  if (!trimmed) {
    return { plain: null, html: null };
  }

  if (signatureIsHtml) {
    return {
      plain: htmlSignatureToPlain(trimmed) || null,
      html: trimmed,
    };
  }

  return { plain: trimmed, html: null };
}

/** Ozer settings first, then Gmail "Send mail as" signature when connected. */
export async function resolveEmailAssistantSignature(
  userId: string,
  settingsSignature: string | null | undefined,
  signatureIsHtml = false,
  mailboxKind: MailboxKind = 'business',
  scope?: GoogleMailboxScope,
): Promise<ResolvedEmailSignature> {
  const fromSettings = parseSettingsSignature(
    settingsSignature,
    signatureIsHtml,
  );

  if (fromSettings.plain || fromSettings.html) {
    return fromSettings;
  }

  try {
    return await getGmailDefaultSignature(userId, mailboxKind, scope);
  } catch (error) {
    if (error instanceof GmailApiError && error.status === 403) {
      return { plain: null, html: null };
    }

    console.error('[email-assistant] resolveEmailAssistantSignature:', error);
    return { plain: null, html: null };
  }
}
