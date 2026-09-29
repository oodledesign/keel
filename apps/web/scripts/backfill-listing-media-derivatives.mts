#!/usr/bin/env node
/**
 * Create thumb + preview copies for existing listing photos so display
 * surfaces stop using Supabase Image Transformations. Originals are untouched.
 *
 * Usage (from apps/web):
 *   pnpm exec tsx scripts/backfill-listing-media-derivatives.mts --dry-run
 *   pnpm exec tsx scripts/backfill-listing-media-derivatives.mts
 *   pnpm exec tsx scripts/backfill-listing-media-derivatives.mts --account=<uuid>
 *   pnpm exec tsx scripts/backfill-listing-media-derivatives.mts --concurrency=4
 *
 * Loads NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SECRET_KEY from .env* files.
 */
import { createClient } from '@supabase/supabase-js';

import { existsSync, readFileSync } from 'node:fs';
import { register } from 'node:module';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

register(
  'data:text/javascript,' +
    encodeURIComponent(`
  export async function resolve(specifier, context, nextResolve) {
    if (specifier === 'server-only') {
      return {
        shortCircuit: true,
        url: ${JSON.stringify(pathToFileURL(resolve(process.cwd(), 'scripts/stubs/server-only.mjs')).href)},
      };
    }
    return nextResolve(specifier, context);
  }
`),
  pathToFileURL(
    resolve(process.cwd(), 'scripts/backfill-listing-media-derivatives.mts'),
  ).href,
);

const PAGE_SIZE = 50;

function loadEnvFiles() {
  const root = resolve(process.cwd());
  for (const file of [
    resolve(root, '.env'),
    resolve(root, '.env.development'),
    resolve(root, '.env.local'),
  ]) {
    if (!existsSync(file)) continue;
    for (const line of readFileSync(file, 'utf8').split('\n')) {
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
  let concurrency = 4;
  let dryRun = false;

  for (const arg of argv) {
    if (arg === '--dry-run') dryRun = true;
    if (arg.startsWith('--account=')) {
      accountId = arg.slice('--account='.length).trim() || undefined;
    }
    if (arg.startsWith('--concurrency=')) {
      concurrency = Math.max(
        1,
        Math.min(8, Number(arg.slice('--concurrency='.length)) || 4),
      );
    }
  }

  return { accountId, concurrency, dryRun };
}

async function mapPool<T, R>(
  items: T[],
  concurrency: number,
  mapper: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, async () => {
      while (next < items.length) {
        const index = next++;
        results[index] = await mapper(items[index]!);
      }
    }),
  );
  return results;
}

async function main() {
  loadEnvFiles();
  const { accountId, concurrency, dryRun } = parseArgs(process.argv.slice(2));

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const secret =
    process.env.SUPABASE_SECRET_KEY?.trim() ||
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !secret) {
    throw new Error(
      'NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY are required',
    );
  }

  const { ensureListingMediaDerivatives, listListingMediaMissingDerivatives } =
    await import('../lib/commercial/listing-media-derivatives.server.ts');

  const client = createClient(url, secret, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });

  console.log(
    `[derivatives] start url=${url} concurrency=${concurrency} dryRun=${dryRun}${accountId ? ` account=${accountId}` : ''}`,
  );

  let afterId: string | undefined;
  let created = 0;
  let skipped = 0;
  let failed = 0;
  let seen = 0;

  while (true) {
    const rows = await listListingMediaMissingDerivatives(client, {
      accountId,
      limit: PAGE_SIZE,
      afterId,
    });
    if (rows.length === 0) break;
    afterId = rows[rows.length - 1]!.id;
    seen += rows.length;

    if (dryRun) continue;

    const results = await mapPool(rows, concurrency, (row) =>
      ensureListingMediaDerivatives(client, row),
    );
    for (const result of results) {
      if (result.status === 'created') created += 1;
      else if (result.status === 'skipped') skipped += 1;
      else {
        failed += 1;
        console.warn(`[derivatives] fail ${result.id}: ${result.error}`);
      }
    }
    console.log(
      `[derivatives] progress seen=${seen} created=${created} skipped=${skipped} failed=${failed}`,
    );
  }

  console.log(
    dryRun
      ? `[derivatives] dry run: ${seen} photos need copies`
      : `[derivatives] done seen=${seen} created=${created} skipped=${skipped} failed=${failed}`,
  );
  if (failed > 0) process.exitCode = 1;
}

main().catch((error) => {
  console.error('[derivatives] fatal:', error);
  process.exit(1);
});
