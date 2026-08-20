#!/usr/bin/env node
/**
 * Import Kato floor units and EPC letter bands onto commercial listings.
 *
 * Usage (from apps/web):
 *   pnpm exec tsx scripts/ingest-kato-listing-enrichment.mts --account=<uuid>
 */
import { createClient } from '@supabase/supabase-js';

import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { ingestKatoListingEnrichment } from '../lib/commercial/ingest-kato-listing-enrichment.ts';
import {
  DEFAULT_KATO_FEED_URL,
  fetchKatoFeedXml,
} from '../lib/commercial/kato-feed-files.ts';

function loadEnvFiles() {
  const root = resolve(process.cwd());
  for (const file of [
    resolve(root, '.env'),
    resolve(root, '.env.development'),
    resolve(root, '.env.local'),
  ]) {
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

async function main() {
  loadEnvFiles();
  const accountArg = process.argv.find((arg) => arg.startsWith('--account='));
  const accountId = accountArg?.slice('--account='.length).trim();
  const feedArg = process.argv.find((arg) => arg.startsWith('--feed-url='));
  const feedUrl =
    feedArg?.slice('--feed-url='.length).trim() || DEFAULT_KATO_FEED_URL;

  if (!accountId) throw new Error('--account=<uuid> is required');

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

  console.log(`[kato-enrich] fetching ${feedUrl}`);
  const xml = await fetchKatoFeedXml(feedUrl);
  const summary = await ingestKatoListingEnrichment(client, {
    accountId,
    xml,
    onProgress: (message) => console.log(`[kato-enrich] ${message}`),
  });
  console.log(JSON.stringify(summary, null, 2));
}

main().catch((error) => {
  console.error('[kato-enrich] fatal:', error);
  process.exit(1);
});
