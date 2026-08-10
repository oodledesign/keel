#!/usr/bin/env node
/**
 * Migrate commercial_listing_media rows from external hosts (e.g. AS imgix)
 * into the Ozer `commercial-listing-media` storage bucket.
 *
 * Usage (from apps/web):
 *   pnpm exec tsx scripts/migrate-external-listing-media.mts
 *   pnpm exec tsx scripts/migrate-external-listing-media.mts --limit=100
 *   pnpm exec tsx scripts/migrate-external-listing-media.mts --all
 *   pnpm exec tsx scripts/migrate-external-listing-media.mts --account=<uuid>
 *   pnpm exec tsx scripts/migrate-external-listing-media.mts --concurrency=5
 *
 * Loads NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SECRET_KEY from .env* files.
 */
import { createClient } from '@supabase/supabase-js';

import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { migrateExternalListingMediaBatch } from '../lib/commercial/migrate-external-listing-media.ts';

function loadEnvFiles() {
  const root = resolve(process.cwd());
  const candidates = [
    resolve(root, '.env'),
    resolve(root, '.env.development'),
    resolve(root, '.env.local'),
  ];

  for (const file of candidates) {
    if (!existsSync(file)) continue;
    const text = readFileSync(file, 'utf8');
    for (const line of text.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq <= 0) continue;
      const key = trimmed.slice(0, eq).trim();
      let value = trimmed.slice(eq + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (process.env[key] == null || process.env[key] === '') {
        process.env[key] = value;
      }
    }
  }
}

function parseArgs(argv: string[]) {
  let limit = 50;
  let all = false;
  let accountId: string | undefined;
  let concurrency = 5;

  for (const arg of argv) {
    if (arg === '--all') {
      all = true;
      continue;
    }
    if (arg.startsWith('--limit=')) {
      limit = Math.max(1, Number(arg.slice('--limit='.length)) || 50);
      continue;
    }
    if (arg.startsWith('--account=')) {
      accountId = arg.slice('--account='.length).trim() || undefined;
      continue;
    }
    if (arg.startsWith('--concurrency=')) {
      concurrency = Math.max(
        1,
        Math.min(10, Number(arg.slice('--concurrency='.length)) || 5),
      );
    }
  }

  return { limit, all, accountId, concurrency };
}

async function main() {
  loadEnvFiles();
  const { limit, all, accountId, concurrency } = parseArgs(
    process.argv.slice(2),
  );

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const secret =
    process.env.SUPABASE_SECRET_KEY?.trim() ||
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (!url || !secret) {
    throw new Error(
      'NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY are required',
    );
  }

  const client = createClient(url, secret, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });

  console.log(
    `[media-migrate] start url=${url} all=${all} batchLimit=${limit} concurrency=${concurrency}${accountId ? ` account=${accountId}` : ''}`,
  );

  let totalMigrated = 0;
  let totalFailed = 0;
  let totalSkipped = 0;
  let rounds = 0;

  do {
    rounds += 1;
    const summary = await migrateExternalListingMediaBatch(client, {
      accountId,
      limit,
      concurrency,
      onProgress: (result) => {
        if (result.status === 'failed') {
          console.warn(
            `[media-migrate] fail ${result.id}: ${result.error ?? 'unknown'}`,
          );
        } else if (result.status === 'migrated') {
          console.log(
            `[media-migrate] ok ${result.id} → ${result.storagePath}`,
          );
        }
      },
    });

    totalMigrated += summary.migrated;
    totalFailed += summary.failed;
    totalSkipped += summary.skipped;

    console.log(
      `[media-migrate] round ${rounds}: processed=${summary.processed} migrated=${summary.migrated} skipped=${summary.skipped} failed=${summary.failed} remaining≈${summary.remaining}`,
    );

    if (!all) break;
    if (summary.processed === 0) break;
    if (summary.migrated === 0 && summary.failed > 0) {
      console.error(
        '[media-migrate] stopping: no successful migrations in this round',
      );
      break;
    }
  } while (all);

  console.log(
    `[media-migrate] done rounds=${rounds} migrated=${totalMigrated} skipped=${totalSkipped} failed=${totalFailed}`,
  );

  if (totalFailed > 0) process.exitCode = 1;
}

main().catch((error) => {
  console.error('[media-migrate] fatal:', error);
  process.exit(1);
});
