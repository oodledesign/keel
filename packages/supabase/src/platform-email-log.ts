import 'server-only';

import { getSupabaseServerAdminClient } from './clients/server-admin-client';

export type PlatformEmailLogStatus = 'sent' | 'failed';

export type PlatformEmailLogEntry = {
  emailType: string;
  accountId?: string | null;
  recipientEmail: string;
  senderEmail?: string | null;
  subject: string;
  status: PlatformEmailLogStatus;
  errorMessage?: string | null;
  metadata?: Record<string, unknown>;
};

/**
 * Persist an outbound email event. Failures are logged to stderr only so email
 * delivery is never blocked by logging issues.
 */
export async function insertPlatformEmailLog(
  entry: PlatformEmailLogEntry,
): Promise<void> {
  try {
    const client = getSupabaseServerAdminClient();

    const { error } = await (
      client as unknown as {
        from: (table: string) => {
          insert: (
            values: Record<string, unknown>,
          ) => PromiseLike<{ error: { message: string } | null }>;
        };
      }
    )
      .from('platform_email_log')
      .insert({
        email_type: entry.emailType,
        account_id: entry.accountId ?? null,
        recipient_email: entry.recipientEmail,
        sender_email: entry.senderEmail ?? null,
        subject: entry.subject,
        status: entry.status,
        error_message: entry.errorMessage ?? null,
        metadata: entry.metadata ?? {},
      });

    if (error) {
      console.error('[platform_email_log] insert failed:', error.message);
    }
  } catch (err) {
    console.error('[platform_email_log] insert failed:', err);
  }
}
