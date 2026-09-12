import 'server-only';

import { getMailer, sanitizeEmailSender } from '@kit/mailers';
import { createSesMailer } from '@kit/ses';
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
  'signature_sync',
  'signature_connect',
  'commercial_match_digest',
  'commercial_circulation',
  'user_signup',
  'invite_accepted',
  'meeting_notes',
  'sending_domain',
  'form_autoresponder',
  'form_notification',
  'form_resume',
  'project_retainer_digest',
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
  /** When set, send via workspace SES identity instead of the Ozer Zepto/Resend rail. */
  ses?: {
    tenant?: string | null;
    configurationSet?: string | null;
  };
}): Promise<void> {
  const recipient = params.mail.to.trim();

  const mail = {
    ...params.mail,
    from: sanitizeEmailSender(params.mail.from),
  };
  let status: 'sent' | 'failed' = 'sent';
  let errorMessage: string | null = null;
  let sesMessageId: string | null = null;

  try {
    if (params.ses) {
      const htmlBody = 'html' in mail ? mail.html : `<pre>${mail.text}</pre>`;
      const mailer = createSesMailer();
      const result = await mailer.sendEmail({
        to: mail.to,
        from: mail.from,
        subject: mail.subject,
        html: htmlBody,
        replyTo: mail.replyTo,
        sesTenant: params.ses.tenant ?? undefined,
        sesConfigurationSet: params.ses.configurationSet ?? undefined,
      });
      sesMessageId =
        result &&
        typeof result === 'object' &&
        'messageId' in result &&
        typeof result.messageId === 'string'
          ? result.messageId
          : null;
    } else if (
      process.env.MAILER_PROVIDER === 'resend' &&
      !process.env.ZEPTOMAIL_TOKEN?.trim()
    ) {
      const mailer = await getMailer();
      await mailer.sendEmail(mail);
    } else {
      const htmlBody = 'html' in mail ? mail.html : `<pre>${mail.text}</pre>`;
      const textBody = 'text' in mail ? mail.text : htmlToPlainText(htmlBody);

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
    errorMessage = formatEmailDeliveryError(error);
    throw new Error(errorMessage);
  } finally {
    const htmlBody = 'html' in mail ? mail.html : undefined;
    await insertPlatformEmailLog({
      emailType: params.type,
      accountId: params.accountId ?? null,
      recipientEmail: mail.to,
      senderEmail: mail.from,
      subject: mail.subject,
      status,
      errorMessage,
      metadata: {
        ...(params.metadata ?? {}),
        ...(params.ses
          ? {
              provider: 'ses',
              ses_message_id: sesMessageId,
              ses_tenant: params.ses.tenant ?? null,
            }
          : {}),
      },
      htmlBody: htmlBody ?? null,
    });
  }
}
