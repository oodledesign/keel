import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import { createMatchSuggestionsService } from '~/home/[account]/listings/_lib/server/match-suggestions.service';
import { getAppSiteOrigin } from '~/lib/app-host-routing';
import {
  type DigestEmailMatch,
  buildCommercialMatchDigestBodyHtml,
} from '~/lib/commercial/commercial-match-digest-email';
import {
  buildCommercialListingMediaPublicUrl,
  resolveSiteUrlForPublicMedia,
} from '~/lib/commercial/listing-media-public-url';
import { wrapNotificationEmail } from '~/lib/email/wrap-notification-email';
import { createInAppNotification } from '~/lib/notifications/create-in-app-notification';
import { isEmailNotificationEnabled } from '~/lib/notifications/email-notification-preferences';
import { sendPlatformEmail } from '~/lib/server/send-platform-email';

const MAX_ACCOUNTS = 80;
/** Fetch enough pairs so the email can group several properties. */
const DIGEST_LIMIT = 24;

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

async function loadOwnerAdminRecipients(
  admin: SupabaseClient,
  slug: string,
): Promise<Array<{ userId: string; email: string }>> {
  const { data: members } = await admin.rpc('get_account_members', {
    account_slug: slug,
  });

  const seen = new Set<string>();
  const recipients: Array<{ userId: string; email: string }> = [];

  for (const member of (members ?? []) as Array<{
    user_id?: string | null;
    role?: string | null;
    email?: string | null;
  }>) {
    if (member.role !== 'owner' && member.role !== 'admin') continue;
    const userId = member.user_id?.trim();
    const email = member.email?.trim().toLowerCase();
    if (!userId || !email || seen.has(email)) continue;
    seen.add(email);
    recipients.push({ userId, email });
  }

  return recipients;
}

async function loadEmailPreferenceMap(
  admin: SupabaseClient,
  userIds: string[],
): Promise<Map<string, unknown>> {
  const map = new Map<string, unknown>();
  if (userIds.length === 0) return map;

  const { data } = await admin
    .from('user_settings')
    .select('user_id, email_notification_preferences')
    .in('user_id', userIds);

  for (const row of (data ?? []) as Array<{
    user_id: string;
    email_notification_preferences?: unknown;
  }>) {
    map.set(row.user_id, row.email_notification_preferences);
  }

  return map;
}

/**
 * Stable public cover URLs for email clients (proxy route, not short-lived signed URLs).
 */
export async function loadListingCoverUrlsForDigest(
  admin: SupabaseClient,
  listingIds: string[],
  siteUrl: string,
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  const uniqueIds = [...new Set(listingIds.filter(Boolean))];
  if (uniqueIds.length === 0) return map;

  const origin = siteUrl.trim().replace(/\/+$/, '');
  if (!origin) return map;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = admin as any;
  const { data, error } = await db
    .from('commercial_listing_media')
    .select(
      'id, listing_id, media_type, file_name, mime_type, storage_path, external_url, is_cover, sort_order',
    )
    .in('listing_id', uniqueIds)
    .eq('is_private', false)
    .or('media_type.eq.image,mime_type.ilike.image/%')
    .order('is_cover', { ascending: false })
    .order('sort_order', { ascending: true });

  if (error) {
    console.error('[match-digest] cover media', error.message);
    return map;
  }

  for (const row of (data ?? []) as Array<{
    id?: string | null;
    listing_id?: string | null;
    media_type?: string | null;
    file_name?: string | null;
    mime_type?: string | null;
    storage_path?: string | null;
    external_url?: string | null;
  }>) {
    const listingId = row.listing_id?.trim();
    if (!listingId || map.has(listingId)) continue;

    const mediaId = row.id?.trim();
    if (mediaId) {
      map.set(
        listingId,
        buildCommercialListingMediaPublicUrl({
          siteUrl: origin,
          mediaId,
          mediaType: row.media_type ?? 'image',
          fileName: row.file_name,
          mimeType: row.mime_type,
        }),
      );
      continue;
    }

    const external = row.external_url?.trim();
    if (external && /^https?:\/\//i.test(external)) {
      map.set(listingId, external);
    }
  }

  return map;
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

      const recipients = await loadOwnerAdminRecipients(admin, account.slug);
      if (recipients.length === 0) continue;

      const prefsByUser = await loadEmailPreferenceMap(
        admin,
        recipients.map((r) => r.userId),
      );

      const appOrigin =
        resolveSiteUrlForPublicMedia() ?? getAppSiteOrigin() ?? siteUrl;
      const pipelineUrl = new URL(linkPath, appOrigin).toString();
      const coverByListing = await loadListingCoverUrlsForDigest(
        admin,
        digest.suggestions.map((s) => s.listingId),
        appOrigin,
      );

      const emailSuggestions: DigestEmailMatch[] = digest.suggestions.map(
        (s) => ({
          listingId: s.listingId,
          listingName: s.listingName,
          requirementLabel: s.requirementLabel,
          score: s.score,
          listingCoverUrl: coverByListing.get(s.listingId) ?? null,
        }),
      );

      const { html: bodyHtml, renderedPairCount } =
        buildCommercialMatchDigestBodyHtml({
          accountName: account.name,
          totalCount: digest.count,
          suggestions: emailSuggestions,
          viewAllHref: pipelineUrl,
          productName,
        });

      const ctaLabel =
        digest.count > renderedPairCount
          ? `View all ${digest.count} matches`
          : `Open matches in ${productName}`;

      const html = wrapNotificationEmail(bodyHtml, {
        title: 'Commercial match digest',
        heading: 'New match suggestions',
        preview: `${digest.count} commercial match suggestion${
          digest.count === 1 ? '' : 's'
        }`,
        cta: {
          label: ctaLabel,
          href: pipelineUrl,
        },
        productName,
      });

      for (const recipient of recipients) {
        if (
          !isEmailNotificationEnabled(
            prefsByUser.get(recipient.userId),
            'commercial_match_digest',
          )
        ) {
          continue;
        }
        try {
          await sendPlatformEmail({
            type: 'commercial_match_digest',
            accountId: account.accountId,
            mail: {
              from: sender,
              to: recipient.email,
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
            `${account.slug}/${recipient.email}: ${
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
