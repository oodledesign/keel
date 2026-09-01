import 'server-only';

import { createSesMailer } from '@kit/ses';
import { insertPlatformEmailLog } from '@kit/supabase/platform-email-log';

export async function sendCampaignEmailViaSes(input: {
  to: string;
  from: string;
  replyTo?: string;
  subject: string;
  html: string;
  listUnsubscribeUrl: string;
  accountId?: string | null;
  sesTenant?: string;
  sesConfigurationSet?: string;
  metadata?: Record<string, unknown>;
}): Promise<{ messageId: string | null }> {
  let status: 'sent' | 'failed' = 'sent';
  let errorMessage: string | null = null;
  let messageId: string | null = null;

  try {
    const mailer = createSesMailer();
    const result = await mailer.sendEmail({
      to: input.to,
      from: input.from,
      subject: input.subject,
      html: input.html,
      replyTo: input.replyTo,
      listUnsubscribeUrl: input.listUnsubscribeUrl,
      sesTenant: input.sesTenant,
      sesConfigurationSet: input.sesConfigurationSet,
    });
    messageId =
      result &&
      typeof result === 'object' &&
      'messageId' in result &&
      typeof result.messageId === 'string'
        ? result.messageId
        : null;
  } catch (error) {
    status = 'failed';
    errorMessage = error instanceof Error ? error.message : String(error);
    throw error;
  } finally {
    await insertPlatformEmailLog({
      emailType: 'campaign',
      accountId: input.accountId ?? null,
      recipientEmail: input.to,
      senderEmail: input.from,
      subject: input.subject,
      status,
      errorMessage,
      metadata: {
        provider: 'ses',
        ses_message_id: messageId,
        ...(input.metadata ?? {}),
      },
    });
  }

  return { messageId };
}
