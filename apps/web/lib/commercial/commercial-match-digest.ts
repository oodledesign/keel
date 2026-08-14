import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import { createMatchSuggestionsService } from '~/home/[account]/listings/_lib/server/match-suggestions.service';
import {
  escapeNotificationHtml,
  wrapNotificationEmail,
} from '~/lib/email/wrap-notification-email';
import { createInAppNotification } from '~/lib/notifications/create-in-app-notification';
import { sendPlatformEmail } from '~/lib/server/send-platform-email';

const MAX_ACCOUNTS = 80;
const DIGEST_LIMIT = 8;

type DigestAccount = {
  accountId: string;
  slug: string;
  name: string;
};

async function loadCommercialAccounts(
  admin: SupabaseClient,
): Promise<DigestAccount[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = admin as any;
  const { data, error } = await db
    .from('commercial_listings')
    .select('account_id')
    .limit(2000);

  if (error) {
    console.error('[match-digest] list accounts', error.message);
    return [];
  }

  const accountIds = [
    ...new Set(
      ((data ?? []) as Array<{ account_id: string }>).map(
        (row) => row.account_id,
      ),
    ),
  ].slice(0, MAX_ACCOUNTS);

  if (accountIds.length === 0) return [];

  const { data: accounts, error: accountsError } = await admin
    .from('accounts')
    .select('id, slug, name')
    .in('id', accountIds)
    .eq('is_personal_account', false);

  if (accountsError) {
    console.error('[match-digest] accounts', accountsError.message);
    return [];
  }

  return (
    (accounts ?? []) as Array<{
      id: string;
      slug: string | null;
      name: string | null;
    }>
  )
    .filter((row) => Boolean(row.slug))
    .map((row) => ({
      accountId: row.id,
      slug: row.slug!,
      name: row.name?.trim() || row.slug!,
    }));
}

async function loadOwnerAdminEmails(
  admin: SupabaseClient,
  slug: string,
): Promise<string[]> {
  const { data: members } = await admin.rpc('get_account_members', {
    account_slug: slug,
  });

  return Array.from(
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
  );
}

export async function runCommercialMatchDigest(admin: SupabaseClient): Promise<{
  accounts: number;
  notified: number;
  emailed: number;
  skipped: number;
  errors: string[];
}> {
  const sender = process.env.EMAIL_SENDER?.trim();
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  const productName = process.env.NEXT_PUBLIC_PRODUCT_NAME ?? 'Ozer';

  const accounts = await loadCommercialAccounts(admin);
  const suggestionsService = createMatchSuggestionsService(admin);

  let notified = 0;
  let emailed = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const account of accounts) {
    try {
      const digest = await suggestionsService.deskDigest({
        accountId: account.accountId,
        limit: DIGEST_LIMIT,
      });

      if (digest.count === 0) {
        skipped += 1;
        continue;
      }

      const linkPath = `/home/${account.slug}/pipeline?view=requirements`;
      const body = `${digest.count} new commercial match suggestion${
        digest.count === 1 ? '' : 's'
      } for ${account.name}. Top fit: ${
        digest.suggestions[0]?.listingName ?? 'disposal'
      } ↔ ${digest.suggestions[0]?.requirementLabel ?? 'requirement'} (${
        digest.suggestions[0]?.score ?? 0
      }%).`;

      await createInAppNotification({
        accountId: account.accountId,
        body,
        link: linkPath,
      });
      notified += 1;

      if (!sender || !siteUrl) {
        continue;
      }

      const emails = await loadOwnerAdminEmails(admin, account.slug);
      if (emails.length === 0) continue;

      const pipelineUrl = new URL(linkPath, siteUrl).toString();
      const topLines = digest.suggestions
        .slice(0, 5)
        .map(
          (s) =>
            `<li style="margin:0 0 8px;"><strong>${escapeNotificationHtml(
              s.listingName,
            )}</strong> ↔ ${escapeNotificationHtml(
              s.requirementLabel,
            )} · ${s.score}% fit</li>`,
        )
        .join('');

      const html = wrapNotificationEmail(
        `
          <p style="margin:0 0 16px;">${escapeNotificationHtml(
            account.name,
          )} has <strong>${digest.count}</strong> open match suggestion${
            digest.count === 1 ? '' : 's'
          } across active stock and requirements.</p>
          <ul style="margin:0 0 20px;padding-left:18px;">${topLines}</ul>
        `,
        {
          title: 'Commercial match digest',
          heading: 'New match suggestions',
          preview: `${digest.count} commercial match suggestion${
            digest.count === 1 ? '' : 's'
          }`,
          cta: {
            label: 'Open requirements pipeline',
            href: pipelineUrl,
          },
          productName,
        },
      );

      for (const email of emails) {
        try {
          await sendPlatformEmail({
            type: 'commercial_match_digest',
            accountId: account.accountId,
            mail: {
              from: sender,
              to: email,
              subject: `${productName}: ${digest.count} commercial match suggestion${
                digest.count === 1 ? '' : 's'
              }`,
              html,
            },
            metadata: {
              event: 'commercial_match_digest',
              suggestion_count: digest.count,
            },
          });
          emailed += 1;
        } catch (err) {
          errors.push(
            `${account.slug}/${email}: ${
              err instanceof Error ? err.message : String(err)
            }`,
          );
        }
      }
    } catch (err) {
      errors.push(
        `${account.slug}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  return {
    accounts: accounts.length,
    notified,
    emailed,
    skipped,
    errors,
  };
}
