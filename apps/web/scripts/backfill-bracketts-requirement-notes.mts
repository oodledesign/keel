#!/usr/bin/env node
/**
 * Clean imported Bracketts requirement notes:
 * - Move [import_key:…] → external_key
 * - Move Use: … → sector (raw use text)
 * - Move Details sent: … → details_sent / details_note
 * - Drop Size: … lines (already in size fields)
 * - Leave remaining text as notes
 *
 * Dry-run:
 *   pnpm exec tsx scripts/backfill-bracketts-requirement-notes.mts --account-slug=bracketts
 *
 * Write:
 *   pnpm exec tsx scripts/backfill-bracketts-requirement-notes.mts --account-slug=bracketts --write
 */
import { createClient } from '@supabase/supabase-js';

import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { parseDetailsSent } from '../lib/commercial/requirement-use-class.ts';

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

function parseImportedNotes(notes: string | null): {
  externalKey: string | null;
  useRaw: string | null;
  detailsRaw: string | null;
  cleanNotes: string | null;
} | null {
  if (!notes?.includes('[import_key:')) return null;

  let externalKey: string | null = null;
  let useRaw: string | null = null;
  let detailsRaw: string | null = null;
  const body: string[] = [];

  for (const line of notes.split('\n')) {
    const keyMatch = line.match(/^\[import_key:(.+)\]\s*$/);
    if (keyMatch) {
      externalKey = keyMatch[1]!.trim();
      continue;
    }
    if (/^Use:\s*/i.test(line)) {
      useRaw = line.replace(/^Use:\s*/i, '').trim() || null;
      continue;
    }
    if (/^Details sent:\s*/i.test(line)) {
      detailsRaw = line.replace(/^Details sent:\s*/i, '').trim() || null;
      continue;
    }
    if (/^Size:\s*/i.test(line)) continue;
    body.push(line);
  }

  const cleanNotes = body.join('\n').trim() || null;
  return { externalKey, useRaw, detailsRaw, cleanNotes };
}

async function main() {
  loadEnvFiles();
  const write = process.argv.includes('--write');
  const slugArg = process.argv.find((a) => a.startsWith('--account-slug='));
  const accountSlug = slugArg?.split('=')[1] ?? 'bracketts';

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SECRET_KEY');
  }

  const admin = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: account, error: accountError } = await admin
    .from('accounts')
    .select('id, slug')
    .eq('slug', accountSlug)
    .single();

  if (accountError || !account) {
    throw new Error(`Account not found: ${accountSlug}`);
  }

  const { data: rows, error } = await admin
    .from('commercial_requirements')
    .select('id, notes, sector, details_sent, details_note, external_key')
    .eq('account_id', account.id)
    .ilike('notes', '%[import_key:%');

  if (error) throw new Error(error.message);

  let updated = 0;
  let skipped = 0;

  for (const row of rows ?? []) {
    const parsed = parseImportedNotes(row.notes as string | null);
    if (!parsed) {
      skipped += 1;
      continue;
    }

    const details = parseDetailsSent(parsed.detailsRaw);
    const patch = {
      external_key: parsed.externalKey ?? row.external_key,
      sector: parsed.useRaw ?? row.sector,
      details_sent: details.sent,
      details_note: details.note,
      notes: parsed.cleanNotes,
      updated_at: new Date().toISOString(),
    };

    if (!write) {
      if (updated < 3) {
        console.log('sample', {
          id: row.id,
          from: String(row.notes).slice(0, 120),
          to: patch,
        });
      }
      updated += 1;
      continue;
    }

    const { error: updateError } = await admin
      .from('commercial_requirements')
      .update(patch)
      .eq('id', row.id)
      .eq('account_id', account.id);

    if (updateError) {
      console.error(`Failed ${row.id}:`, updateError.message);
      skipped += 1;
      continue;
    }
    updated += 1;
  }

  console.log(
    JSON.stringify(
      {
        accountSlug,
        write,
        matched: rows?.length ?? 0,
        updated,
        skipped,
      },
      null,
      2,
    ),
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
