import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import { getLogger } from '@kit/shared/logger';

import {
  escapeEmailHtml,
  renderOzerTransactionalEmail,
} from '~/lib/email/ozer-transactional-shell';
import { sendPlatformEmail } from '~/lib/server/send-platform-email';

import {
  type PurgeNoticeKind,
  daysUntilPurge,
  formatPurgeDate,
  nextPurgeNotice,
} from './account-storage-purge.shared';

type AnyClient = SupabaseClient;

const PURGE_BUCKETS = [
  'account_image',
  'account-documents',
  'brand-assets',
  'signatures-photos',
  'support-attachments',
  'property-documents',
  'video-masters',
  'media-generation',
  'commercial-listing-media',
] as const;

const REMOVE_BATCH = 100;

export type AccountStoragePurgeResult = {
  processed: number;
  purged: number;
  failed: number;
  overdue: number;
  noticesSent: number;
  noticesSkipped: number;
  errors: string[];
};

type PurgeRow = {
  id: string;
  account_id: string;
  requested_at: string;
  purge_after: string;
  owner_email: string | null;
  account_name: string | null;
  notice_14d_sent_at: string | null;
  notice_3d_sent_at: string | null;
};

export async function enqueueAccountStoragePurge(
  admin: AnyClient,
  accountId: string,
  snapshot?: { email?: string | null; name?: string | null },
): Promise<void> {
  const { error } = await admin.rpc('prepare_account_storage_purge', {
    target_account_id: accountId,
    target_email: snapshot?.email ?? null,
    target_name: snapshot?.name ?? null,
  });

  if (error) throw error;
}

async function listFolderPaths(
  admin: AnyClient,
  bucket: string,
  folder: string,
): Promise<string[]> {
  const paths: string[] = [];
  let offset = 0;

  for (;;) {
    const { data, error } = await admin.storage.from(bucket).list(folder, {
      limit: 100,
      offset,
    });

    if (error || !data?.length) {
      break;
    }

    for (const item of data) {
      const child = folder ? `${folder}/${item.name}` : item.name;
      const isFolder = item.id === null;
      if (isFolder) {
        paths.push(...(await listFolderPaths(admin, bucket, child)));
      } else {
        paths.push(child);
      }
    }

    if (data.length < 100) break;
    offset += 100;
  }

  return paths;
}

async function collectAccountObjectPaths(
  admin: AnyClient,
  bucket: string,
  accountId: string,
): Promise<string[]> {
  const nested = await listFolderPaths(admin, bucket, accountId);
  const root = await listFolderPaths(admin, bucket, '');
  const prefixed = root.filter(
    (path) =>
      path === accountId ||
      path.startsWith(`${accountId}.`) ||
      path.startsWith(`${accountId}/`),
  );

  return [...new Set([...nested, ...prefixed])];
}

async function removePaths(
  admin: AnyClient,
  bucket: string,
  paths: string[],
): Promise<void> {
  for (let i = 0; i < paths.length; i += REMOVE_BATCH) {
    const batch = paths.slice(i, i + REMOVE_BATCH);
    const { error } = await admin.storage.from(bucket).remove(batch);
    if (error) {
      throw error;
    }
  }
}

async function purgeAccountStorage(
  admin: AnyClient,
  accountId: string,
): Promise<number> {
  let removed = 0;

  for (const bucket of PURGE_BUCKETS) {
    const paths = await collectAccountObjectPaths(admin, bucket, accountId);
    if (!paths.length) continue;
    await removePaths(admin, bucket, paths);
    removed += paths.length;
  }

  return removed;
}

function purgeNoticeCopy(kind: PurgeNoticeKind, dateLabel: string) {
  if (kind === 'notice_3d') {
    return {
      subject: `Final warning: remaining files deleted on ${dateLabel}`,
      preview: `Remaining files from your deleted account will be permanently deleted on ${dateLabel} and cannot be recovered.`,
      heading: 'Final warning — files cannot be recovered',
      extra:
        '<p>This is the last reminder. After that date the remaining files cannot be recovered.</p>',
    };
  }

  return {
    subject: `Remaining files will be permanently deleted on ${dateLabel}`,
    preview: `Uploaded files from your deleted account will be wiped on ${dateLabel} and cannot be recovered.`,
    heading: 'Your remaining files will be deleted',
    extra: '<p>We will send one more reminder a few days before that date.</p>',
  };
}

async function sendPurgeNotice(
  row: PurgeRow,
  kind: PurgeNoticeKind,
  purgeAfter: Date,
): Promise<void> {
  const sender = process.env.EMAIL_SENDER?.trim();
  const productName = process.env.NEXT_PUBLIC_PRODUCT_NAME?.trim() || 'Ozer';
  const to = row.owner_email?.trim();

  if (!sender || !to) {
    throw new Error('Missing EMAIL_SENDER or owner email for purge notice');
  }

  const dateLabel = formatPurgeDate(purgeAfter);
  const copy = purgeNoticeCopy(kind, dateLabel);
  const workspace = row.account_name?.trim()
    ? ` from <strong>${escapeEmailHtml(row.account_name.trim())}</strong>`
    : '';

  const html = renderOzerTransactionalEmail({
    title: copy.heading,
    preview: copy.preview,
    heading: copy.heading,
    bodyHtml: `<p>Your Ozer account was deleted. Workspace records were already removed.</p>
      <p>Remaining uploaded files${workspace} will be permanently deleted on <strong>${escapeEmailHtml(dateLabel)}</strong>. This cannot be undone, and the files cannot be recovered after that date.</p>
      ${copy.extra}
      <p>Questions: <a href="mailto:privacy@ozer.so">privacy@ozer.so</a></p>`,
    footerNote: `You’re receiving this because a ${escapeEmailHtml(productName)} account associated with this email was deleted.`,
    productName,
  });

  await sendPlatformEmail({
    type: 'account_deletion',
    accountId: null,
    mail: {
      to,
      from: sender,
      subject: copy.subject,
      html,
    },
    metadata: {
      notification_type: kind,
      deleted_account_id: row.account_id,
      purge_after: row.purge_after,
    },
  });
}

export async function runAccountStoragePurgeCron(
  admin: AnyClient,
  now = new Date(),
): Promise<AccountStoragePurgeResult> {
  const logger = await getLogger();
  const result: AccountStoragePurgeResult = {
    processed: 0,
    purged: 0,
    failed: 0,
    overdue: 0,
    noticesSent: 0,
    noticesSkipped: 0,
    errors: [],
  };

  const { data, error } = await admin
    .from('account_storage_purges')
    .select(
      'id, account_id, requested_at, purge_after, owner_email, account_name, notice_14d_sent_at, notice_3d_sent_at',
    )
    .in('status', ['pending', 'failed'])
    .order('purge_after', { ascending: true })
    .limit(200);

  if (error) {
    result.errors.push(error.message);
    return result;
  }

  const rows = (data ?? []) as PurgeRow[];

  for (const row of rows) {
    const purgeAfter = new Date(row.purge_after);
    const due = purgeAfter.getTime() <= now.getTime();

    if (!due) {
      const kind = nextPurgeNotice({
        daysLeft: daysUntilPurge(purgeAfter, now),
        notice14dSent: Boolean(row.notice_14d_sent_at),
        notice3dSent: Boolean(row.notice_3d_sent_at),
      });

      if (!kind) {
        continue;
      }

      if (!row.owner_email?.trim() || !process.env.EMAIL_SENDER?.trim()) {
        result.noticesSkipped += 1;
        continue;
      }

      try {
        await sendPurgeNotice(row, kind, purgeAfter);
        const column =
          kind === 'notice_14d' ? 'notice_14d_sent_at' : 'notice_3d_sent_at';
        const { error: markError } = await admin
          .from('account_storage_purges')
          .update({ [column]: now.toISOString() })
          .eq('id', row.id);

        if (markError) throw markError;
        result.noticesSent += 1;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        result.errors.push(`${row.account_id}: ${message}`);
        logger.error(
          { err, accountId: row.account_id, name: 'account-storage-purge' },
          'Failed to send storage purge warning email',
        );
      }

      continue;
    }

    result.processed += 1;
    const requested = new Date(row.requested_at);
    if (now.getTime() - requested.getTime() > 30 * 24 * 60 * 60 * 1000) {
      result.overdue += 1;
    }

    try {
      const removed = await purgeAccountStorage(admin, row.account_id);
      const { error: updateError } = await admin
        .from('account_storage_purges')
        .update({
          status: 'purged',
          purged_at: now.toISOString(),
          objects_removed: removed,
          error: null,
        })
        .eq('id', row.id);

      if (updateError) throw updateError;
      result.purged += 1;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      result.failed += 1;
      result.errors.push(`${row.account_id}: ${message}`);
      logger.error(
        { err, accountId: row.account_id, name: 'account-storage-purge' },
        'Failed to purge storage for deleted account',
      );
      await admin
        .from('account_storage_purges')
        .update({ status: 'failed', error: message })
        .eq('id', row.id);
    }
  }

  return result;
}
