import 'server-only';

import { getMailer, sanitizeEmailSender } from '@kit/mailers';
import { insertPlatformEmailLog } from '@kit/supabase/platform-email-log';

export const PLATFORM_EMAIL_TYPES = [
  'invitation',
  'invoice',
  'proposal',
  'contract',
  'message',
  'event',
  'support_ticket',
  'development_request',
  'beta_expiry',
  'billing',
  'contact_form',
  'otp',
  'account_deletion',
  'compose',
  'campaign',
] as const;

export type PlatformEmailType = (typeof PLATFORM_EMAIL_TYPES)[number];

type MailPayload = {
  to: string;
  from: string;
  subject: string;
  cc?: string[];
} & ({ html: string } | { text: string }) &
  Record<string, unknown>;

/**
 * Send email via the configured mailer and record it in platform_email_log.
 */
export async function sendPlatformEmail(params: {
  type: PlatformEmailType;
  accountId?: string | null;
  mail: MailPayload;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  const mailer = await getMailer();
  const mail = {
    ...params.mail,
    from: sanitizeEmailSender(params.mail.from),
  };
  let status: 'sent' | 'failed' = 'sent';
  let errorMessage: string | null = null;

  try {
    await mailer.sendEmail(mail);
  } catch (error) {
    status = 'failed';
    errorMessage = error instanceof Error ? error.message : String(error);
    throw error;
  } finally {
    await insertPlatformEmailLog({
      emailType: params.type,
      accountId: params.accountId ?? null,
      recipientEmail: mail.to,
      senderEmail: mail.from,
      subject: mail.subject,
      status,
      errorMessage,
      metadata: params.metadata ?? {},
    });
  }
}
