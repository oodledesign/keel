import 'server-only';

import { getMailer, sanitizeEmailSender } from '@kit/mailers';
import { insertPlatformEmailLog } from '@kit/supabase/platform-email-log';

import { isEmailSuppressed } from '~/lib/email/is-suppressed';
import { formatEmailDeliveryError } from '~/lib/email/format-email-delivery-error';
import { sendSesRawEmail } from '~/lib/server/ses-raw-email';

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

function usesSesApi() {
  if (process.env.MAILER_PROVIDER === 'ses') {
    return true;
  }

  if (
    process.env.MAILER_PROVIDER === 'nodemailer' ||
    process.env.MAILER_PROVIDER === 'resend'
  ) {
    return false;
  }

  return Boolean(
    process.env.AWS_ACCESS_KEY_ID &&
      process.env.AWS_SECRET_ACCESS_KEY &&
      (process.env.AWS_REGION ?? process.env.SES_REGION),
  );
}

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
  const recipient = params.mail.to.trim();

  if (await isEmailSuppressed(recipient)) {
    throw new Error(
      `Email could not be sent: ${recipient} is on the suppression list.`,
    );
  }

  const mail = {
    ...params.mail,
    from: sanitizeEmailSender(params.mail.from),
  };
  let status: 'sent' | 'failed' = 'sent';
  let errorMessage: string | null = null;

  try {
    if (usesSesApi()) {
      await sendSesRawEmail({
        to: mail.to,
        from: mail.from,
        subject: mail.subject,
        ...('html' in mail ? { html: mail.html } : { text: mail.text }),
      });
    } else {
      const mailer = await getMailer();
      await mailer.sendEmail(mail);
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
