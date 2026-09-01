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
  /** Rendered HTML for admin preview. Truncated if very large. */
  htmlBody?: string | null;
};

const HTML_BODY_MAX_CHARS = 500_000;

function truncateHtmlBody(html: string | null | undefined): string | null {
  if (!html?.trim()) return null;
  if (html.length <= HTML_BODY_MAX_CHARS) return html;
  return `${html.slice(0, HTML_BODY_MAX_CHARS)}\n<!-- truncated -->`;
}

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
        html_body: truncateHtmlBody(entry.htmlBody),
      });

    if (error) {
      console.error('[platform_email_log] insert failed:', error.message);
    }
  } catch (err) {
    console.error('[platform_email_log] insert failed:', err);
  }
}
