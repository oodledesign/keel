import 'server-only';

import { createSesMailer } from '@kit/ses';
import { insertPlatformEmailLog } from '@kit/supabase/platform-email-log';

import { isSesThrottleError } from '~/lib/campaigns/campaign-send-worker';

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
  /** Defaults to "campaign". Use "campaign_test" for free test sends. */
  emailType?: string;
  /**
   * Bulk campaign sends skip the stored HTML body. The platform log row is
   * still written; copying the full document per recipient dominates at 30k.
   */
  storeHtml?: boolean;
}): Promise<{ messageId: string | null }> {
  let status: 'sent' | 'failed' = 'sent';
  let errorMessage: string | null = null;
  let messageId: string | null = null;
  let throttled = false;

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
    throttled = isSesThrottleError(error);
    if (!throttled) {
      status = 'failed';
      errorMessage = error instanceof Error ? error.message : String(error);
    }
    throw error;
  } finally {
    if (!throttled) {
      await insertPlatformEmailLog({
        emailType: input.emailType ?? 'campaign',
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
        htmlBody: input.storeHtml === false ? null : input.html,
      });
    }
  }

  return { messageId };
}
