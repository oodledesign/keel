import 'server-only';

import { getLogger } from '@kit/shared/logger';
import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

import {
  loadAccountBrandResolved,
  wrapEmailHtmlWithBrand,
} from '~/lib/brand/account-brand';
import { sendPlatformEmail } from '~/lib/server/send-platform-email';

const PROVIDER_LABELS = {
  google: 'Google Workspace',
  microsoft: 'Microsoft 365',
} as const;

type SyncProvider = keyof typeof PROVIDER_LABELS;

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

async function loadOwnerAdminEmails(accountId: string): Promise<{
  emails: string[];
  accountSlug: string | null;
  accountName: string | null;
}> {
  const admin = getSupabaseServerAdminClient();
  const { data: account } = await admin
    .from('accounts')
    .select('slug, name')
    .eq('id', accountId)
    .maybeSingle();

  if (!account?.slug) {
    return { emails: [], accountSlug: null, accountName: null };
  }

  const { data: members } = await admin.rpc('get_account_members', {
    account_slug: account.slug,
  });

  const emails = Array.from(
    new Set(
      (members ?? [])
        .filter((member: { role?: string | null; email?: string | null }) => {
          return (
            (member.role === 'owner' || member.role === 'admin') &&
            Boolean(member.email)
          );
        })
        .map((member: { email?: string | null }) =>
          member.email!.toLowerCase(),
        ),
    ),
  ) as string[];

  return {
    emails,
    accountSlug: account.slug as string,
    accountName: (account.name as string | null) ?? null,
  };
}

/**
 * Email workspace owners/admins that a signatures staff sync completed.
 * Never throws — a notification failure must not fail the sync itself.
 */
export async function sendSignatureSyncCompletedEmail(params: {
  accountId: string;
  provider: SyncProvider;
  synced: number;
  errors: string[];
}): Promise<void> {
  const logger = await getLogger();

  try {
    const sender = process.env.EMAIL_SENDER;
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
    const productName = process.env.NEXT_PUBLIC_PRODUCT_NAME ?? 'Ozer';

    if (!sender) return;

    const { emails, accountSlug, accountName } = await loadOwnerAdminEmails(
      params.accountId,
    );

    if (emails.length === 0) return;

    const providerLabel = PROVIDER_LABELS[params.provider];
    const staffUrl =
      siteUrl && accountSlug
        ? new URL(`/app/${accountSlug}/signatures/staff`, siteUrl).href
        : null;

    const errorCount = params.errors.length;
    const shownErrors = params.errors.slice(0, 5);
    const syncedLabel = `${params.synced} staff member${params.synced === 1 ? '' : 's'}`;

    const errorsHtml = errorCount
      ? `
        <div style="margin:24px 0;padding:16px;border:1px solid #fbbf24;border-radius:12px;background:#fffbeb">
          <p style="margin:0 0 8px"><strong>${errorCount} issue${errorCount === 1 ? '' : 's'} recorded during the sync:</strong></p>
          <ul style="margin:0;padding-left:20px">
            ${shownErrors.map((error) => `<li>${escapeHtml(error)}</li>`).join('')}
          </ul>
          ${errorCount > shownErrors.length ? `<p style="margin:8px 0 0">…and ${errorCount - shownErrors.length} more.</p>` : ''}
        </div>`
      : '';

    const innerHtml = `
      <h2 style="margin:0 0 16px">Signatures sync complete</h2>
      <p>The ${providerLabel} directory sync${accountName ? ` for <strong>${escapeHtml(accountName)}</strong>` : ''} has finished.</p>
      <div style="margin:24px 0;padding:16px;border:1px solid #e5e7eb;border-radius:12px;background:#f9fafb">
        <p style="margin:0 0 4px"><strong>Provider:</strong> ${providerLabel}</p>
        <p style="margin:0 0 4px"><strong>Synced:</strong> ${syncedLabel}</p>
        <p style="margin:0"><strong>Issues:</strong> ${errorCount === 0 ? 'none' : errorCount}</p>
      </div>
      ${errorsHtml}
      ${staffUrl ? `<p><a href="${staffUrl}">Review your staff list</a> to check details and deploy signatures.</p>` : ''}
    `;

    const brand = await loadAccountBrandResolved(params.accountId);
    const subject = `${productName}: ${providerLabel} sync complete — ${syncedLabel}${errorCount ? ` (${errorCount} issue${errorCount === 1 ? '' : 's'})` : ''}`;

    await Promise.allSettled(
      emails.map(async (email) => {
        try {
          await sendPlatformEmail({
            type: 'signature_sync',
            accountId: params.accountId,
            mail: {
              from: sender,
              to: email,
              subject,
              html: wrapEmailHtmlWithBrand({ brand, innerHtml }),
            },
            metadata: {
              provider: params.provider,
              synced: params.synced,
              error_count: errorCount,
            },
          });
        } catch (error) {
          logger.warn(
            { accountId: params.accountId, email, error },
            'Failed to send signature sync notification email',
          );
        }
      }),
    );
  } catch (error) {
    logger.warn(
      { accountId: params.accountId, error },
      'Failed to prepare signature sync notification emails',
    );
  }
}
