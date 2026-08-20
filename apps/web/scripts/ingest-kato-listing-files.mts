#!/usr/bin/env node
/**
 * Import Kato/Agents Society brochure PDFs, EPCs, and floor-plan files
 * into commercial_listing_media, then download into Ozer storage.
 *
 * Usage (from apps/web):
 *   pnpm exec tsx scripts/ingest-kato-listing-files.mts --account=<uuid>
 *   pnpm exec tsx scripts/ingest-kato-listing-files.mts --account=<uuid> --concurrency=4
 */
import { createClient } from '@supabase/supabase-js';

import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { ingestKatoListingFiles } from '../lib/commercial/ingest-kato-listing-files.ts';
import {
  DEFAULT_KATO_FEED_URL,
  fetchKatoFeedXml,
} from '../lib/commercial/kato-feed-files.ts';

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
  let accountId: string | undefined;
  let feedUrl = DEFAULT_KATO_FEED_URL;
  let concurrency = 4;
  let download = true;

  for (const arg of argv) {
    if (arg.startsWith('--account=')) {
      accountId = arg.slice('--account='.length).trim() || undefined;
      continue;
    }
    if (arg.startsWith('--feed-url=')) {
      feedUrl = arg.slice('--feed-url='.length).trim() || DEFAULT_KATO_FEED_URL;
      continue;
    }
    if (arg.startsWith('--concurrency=')) {
      concurrency = Math.max(
        1,
        Math.min(6, Number(arg.slice('--concurrency='.length)) || 4),
      );
      continue;
    }
    if (arg === '--skip-download') {
      download = false;
    }
  }

  return { accountId, feedUrl, concurrency, download };
}

async function main() {
  loadEnvFiles();
  const { accountId, feedUrl, concurrency, download } = parseArgs(
    process.argv.slice(2),
  );

  if (!accountId) {
    throw new Error('--account=<uuid> is required');
  }

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

  console.log(`[kato-files] fetching ${feedUrl}`);
  const xml = await fetchKatoFeedXml(feedUrl);
  console.log(`[kato-files] ingest account=${accountId} download=${download}`);

  const summary = await ingestKatoListingFiles(client, {
    accountId,
    xml,
    concurrency,
    download,
    onProgress: (message) => console.log(`[kato-files] ${message}`),
  });

  console.log(
    JSON.stringify(
      {
        feedItems: summary.feedItems,
        inserted: summary.inserted,
        skippedExisting: summary.skippedExisting,
        unmatched: summary.unmatchedExternalIds.length,
        unmatchedExternalIds: summary.unmatchedExternalIds,
        downloaded: summary.downloaded,
        downloadFailed: summary.downloadFailed,
      },
      null,
      2,
    ),
  );

  if (summary.downloadFailed > 0) process.exitCode = 1;
}

main().catch((error) => {
  console.error('[kato-files] fatal:', error);
  process.exit(1);
});
