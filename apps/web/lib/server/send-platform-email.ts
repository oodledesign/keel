import 'server-only';

import { getMailer, sanitizeEmailSender } from '@kit/mailers';
import { insertPlatformEmailLog } from '@kit/supabase/platform-email-log';

import { formatEmailDeliveryError } from '~/lib/email/format-email-delivery-error';
import { htmlToPlainText } from '~/lib/email/html-to-plain-text';
import { sendTransactionalEmail } from '~/lib/email/zeptomail-client';

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
  'signature_install',
] as const;

export type PlatformEmailType = (typeof PLATFORM_EMAIL_TYPES)[number];

type MailPayload = {
  to: string;
  from: string;
  subject: string;
  cc?: string[];
  replyTo?: string;
  attachments?: Array<{
    name: string;
    content: string;
    mimeType: string;
  }>;
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
  const recipient = params.mail.to.trim();

  const mail = {
    ...params.mail,
    from: sanitizeEmailSender(params.mail.from),
  };
  let status: 'sent' | 'failed' = 'sent';
  let errorMessage: string | null = null;

  try {
    if (process.env.MAILER_PROVIDER === 'resend') {
      const mailer = await getMailer();
      await mailer.sendEmail(mail);
    } else {
      const htmlBody =
        'html' in mail ? mail.html : `<pre>${mail.text}</pre>`;
      const textBody =
        'text' in mail ? mail.text : htmlToPlainText(htmlBody);

      const result = await sendTransactionalEmail({
        to: mail.to,
        subject: mail.subject,
        htmlBody,
        textBody,
        from: mail.from,
        replyTo: mail.replyTo,
        attachments: mail.attachments,
      });

      if (!result.sent) {
        throw new Error(
          `Email could not be sent: ${recipient} is on the suppression list.`,
        );
      }
    }
  } catch (error) {
    status = 'failed';
    errorMessage = error instanceof Error ? error.message : String(error);
    throw new Error(formatEmailDeliveryError(error));
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
