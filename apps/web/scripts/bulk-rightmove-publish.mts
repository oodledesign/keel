#!/usr/bin/env node
/**
 * Bulk-push Bracketts (or any account) commercial listings to Rightmove ADF.
 *
 * Defaults to Rightmove **test** (adftest) when RIGHTMOVE_API_BASE_URL is unset.
 *
 * Dry-run (list only):
 *   pnpm exec tsx scripts/bulk-rightmove-publish.mts --account-slug=bracketts
 *
 * Write:
 *   pnpm exec tsx scripts/bulk-rightmove-publish.mts --account-slug=bracketts --write
 *
 * Options:
 *   --account=<uuid>
 *   --account-slug=<slug>
 *   --status=marketing,under_offer   (default: marketing,under_offer)
 *   --all-statuses                   include sold/let/etc.
 *   --limit=N
 *   --delay-ms=400
 *   --report=path.json
 *
 * Requires NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SECRET_KEY,
 * RIGHTMOVE_CLIENT_ID, RIGHTMOVE_CLIENT_KEY, NEXT_PUBLIC_SITE_URL.
 */
import { createClient } from '@supabase/supabase-js';

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { register } from 'node:module';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

// Allow importing packages that use `import 'server-only'` outside Next.js.
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
  pathToFileURL(resolve(process.cwd(), 'scripts/bulk-rightmove-publish.mts'))
    .href,
);

function loadEnvFiles() {
  const root = resolve(process.cwd());
  for (const file of [
    resolve(root, '.env'),
    resolve(root, '.env.development'),
    resolve(root, '.env.local'),
    resolve(root, '.env.production.local'),
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
  let write = false;
  let allStatuses = false;
  let accountId: string | undefined;
  let accountSlug: string | undefined;
  let statuses = ['marketing', 'under_offer'];
  let limit: number | undefined;
  let delayMs = 1200;
  let retry429 = 6;
  let onlyFailedFrom: string | undefined;
  let onlyPublicationError = false;
  let reportPath = resolve(
    process.cwd(),
    'scripts/data/rightmove-bulk-publish-report.json',
  );

  for (const arg of argv) {
    if (arg === '--write') write = true;
    else if (arg === '--all-statuses') allStatuses = true;
    else if (arg === '--only-publication-error') onlyPublicationError = true;
    else if (arg.startsWith('--account=')) accountId = arg.slice(10);
    else if (arg.startsWith('--account-slug=')) accountSlug = arg.slice(15);
    else if (arg.startsWith('--status=')) {
      statuses = arg
        .slice(9)
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
    } else if (arg.startsWith('--limit=')) {
      limit = Number(arg.slice(8));
    } else if (arg.startsWith('--delay-ms=')) {
      delayMs = Number(arg.slice(11));
    } else if (arg.startsWith('--retry-429=')) {
      retry429 = Number(arg.slice(12));
    } else if (arg.startsWith('--only-failed-from=')) {
      onlyFailedFrom = resolve(process.cwd(), arg.slice(19));
    } else if (arg.startsWith('--report=')) {
      reportPath = resolve(process.cwd(), arg.slice(9));
    }
  }

  return {
    write,
    allStatuses,
    accountId,
    accountSlug,
    statuses,
    limit,
    delayMs,
    retry429,
    onlyFailedFrom,
    onlyPublicationError,
    reportPath,
  };
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  loadEnvFiles();
  const args = parseArgs(process.argv.slice(2));

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const secret =
    process.env.SUPABASE_SECRET_KEY?.trim() ||
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim();

  if (!url || !secret) {
    throw new Error(
      'NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY are required',
    );
  }
  if (!siteUrl) {
    throw new Error('NEXT_PUBLIC_SITE_URL is required for media proxy URLs');
  }
  if (
    !process.env.RIGHTMOVE_CLIENT_ID?.trim() ||
    !process.env.RIGHTMOVE_CLIENT_KEY?.trim()
  ) {
    throw new Error('RIGHTMOVE_CLIENT_ID and RIGHTMOVE_CLIENT_KEY are required');
  }

  // Force test ADF unless explicitly overridden in env.
  if (!process.env.RIGHTMOVE_API_BASE_URL?.trim()) {
    process.env.RIGHTMOVE_API_BASE_URL =
      'https://api-services.adftest.rightmove.com';
  }

  const admin = createClient(url, secret, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  let accountId = args.accountId;
  if (!accountId && args.accountSlug) {
    const { data, error } = await admin
      .from('accounts')
      .select('id, name, slug')
      .eq('slug', args.accountSlug)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) throw new Error(`No account with slug ${args.accountSlug}`);
    accountId = data.id as string;
    console.log(`Account: ${data.name} (${data.slug}) ${accountId}`);
  }
  if (!accountId) {
    throw new Error('Pass --account=<uuid> or --account-slug=<slug>');
  }

  let query = admin
    .from('commercial_listings')
    .select('id, name, status, account_branch_id, postcode, address_line_1')
    .eq('account_id', accountId)
    .order('name');

  if (!args.allStatuses) {
    query = query.in('status', args.statuses);
  }

  const { data: listings, error: listError } = await query;
  if (listError) throw new Error(listError.message);

  let rows = listings ?? [];

  if (args.onlyPublicationError) {
    const { data: pubs, error: pubError } = await admin
      .from('commercial_portal_publications')
      .select('listing_id')
      .eq('account_id', accountId)
      .eq('portal', 'rightmove')
      .eq('status', 'error');
    if (pubError) throw new Error(pubError.message);
    const errorIds = new Set((pubs ?? []).map((p) => p.listing_id as string));
    rows = rows.filter((r) => errorIds.has(r.id as string));
    console.log(`Retrying ${rows.length} listing(s) with Rightmove status=error`);
  }

  if (args.onlyFailedFrom) {
    const prior = JSON.parse(readFileSync(args.onlyFailedFrom, 'utf8')) as {
      results?: Array<{ id: string; ok: boolean; error?: string | null }>;
    };
    const retryIds = new Set(
      (prior.results ?? [])
        .filter((r) => {
          if (r.ok) return false;
          const err = (r.error ?? '').toLowerCase();
          // Retry rate limits; skip hard validation / missing-field failures.
          return err.includes('429') || err.includes('rate limit');
        })
        .map((r) => r.id),
    );
    rows = rows.filter((r) => retryIds.has(r.id as string));
    console.log(
      `Retrying ${rows.length} rate-limited listing(s) from ${args.onlyFailedFrom}`,
    );
  }

  if (args.limit != null && Number.isFinite(args.limit)) {
    rows = rows.slice(0, args.limit);
  }

  const { getRightmoveEnv, isRightmoveOAuthConfigured } =
    await import('../lib/commercial/rightmove-env.ts');
  const { publishToRightmove, setPortalPublishersClient } =
    await import('../lib/commercial/portal-publishers.ts');

  if (!isRightmoveOAuthConfigured()) {
    throw new Error('Rightmove OAuth not configured');
  }
  const env = getRightmoveEnv();
  console.log(
    `Rightmove env: ${env.environment} (${env.apiBaseUrl}) — ${rows.length} listing(s)`,
  );
  console.log(
    args.write
      ? 'Mode: WRITE (will PUT to Rightmove)'
      : 'Mode: dry-run (pass --write to publish)',
  );

  type ResultRow = {
    id: string;
    name: string;
    status: string;
    ok: boolean;
    publicationStatus?: string;
    externalUrl?: string | null;
    error?: string | null;
  };

  const results: ResultRow[] = [];

  if (!args.write) {
    for (const row of rows) {
      results.push({
        id: row.id as string,
        name: row.name as string,
        status: row.status as string,
        ok: true,
      });
    }
    mkdirSync(dirname(args.reportPath), { recursive: true });
    writeFileSync(
      args.reportPath,
      JSON.stringify(
        {
          dryRun: true,
          environment: env.environment,
          accountId,
          count: results.length,
          results,
        },
        null,
        2,
      ),
    );
    console.log(`Dry-run report → ${args.reportPath}`);
    return;
  }

  setPortalPublishersClient(admin as never);

  let okCount = 0;
  let errCount = 0;

  try {
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]!;
      const id = row.id as string;
      const name = row.name as string;
      const label = `[${i + 1}/${rows.length}] ${name}`;

      try {
        let publication = await publishToRightmove(accountId, id);
        let attempt = 0;
        while (
          publication.status === 'error' &&
          (publication.last_error ?? '').toLowerCase().includes('rate limit') &&
          attempt < args.retry429
        ) {
          attempt += 1;
          const waitMs = Math.min(60_000, 5_000 * attempt);
          console.log(
            `RATE-LIMIT ${label} — waiting ${waitMs}ms (retry ${attempt}/${args.retry429})`,
          );
          await sleep(waitMs);
          publication = await publishToRightmove(accountId, id);
        }

        const ok = publication.status !== 'error';
        if (ok) okCount += 1;
        else errCount += 1;

        console.log(
          `${ok ? 'OK' : 'ERR'} ${label} → ${publication.status}` +
            (publication.external_url ? ` ${publication.external_url}` : '') +
            (publication.last_error ? ` — ${publication.last_error}` : ''),
        );

        results.push({
          id,
          name,
          status: row.status as string,
          ok,
          publicationStatus: publication.status,
          externalUrl: publication.external_url,
          error: publication.last_error,
        });
      } catch (err) {
        errCount += 1;
        const message = err instanceof Error ? err.message : String(err);
        console.log(`ERR ${label} — ${message}`);
        results.push({
          id,
          name,
          status: row.status as string,
          ok: false,
          error: message,
        });
      }

      if (i < rows.length - 1 && args.delayMs > 0) {
        await sleep(args.delayMs);
      }
    }
  } finally {
    setPortalPublishersClient(null);
  }

  mkdirSync(dirname(args.reportPath), { recursive: true });
  writeFileSync(
    args.reportPath,
    JSON.stringify(
      {
        dryRun: false,
        environment: env.environment,
        accountId,
        okCount,
        errCount,
        count: results.length,
        results,
      },
      null,
      2,
    ),
  );

  console.log(`\nDone: ${okCount} ok, ${errCount} errors → ${args.reportPath}`);
  if (errCount > 0) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
