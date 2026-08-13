#!/usr/bin/env node
/**
 * Import Bracketts WIP sheet into commercial pipeline_deals + notes.
 *
 * Dry-run (default):
 *   pnpm exec tsx scripts/import-bracketts-wip.mts --account-slug=bracketts
 *
 * Write:
 *   pnpm exec tsx scripts/import-bracketts-wip.mts --account-slug=bracketts --write
 *
 * Options:
 *   --csv=path
 *   --account=<uuid>
 *   --account-slug=<slug>
 *   --backfill-authors   after invitees accept, fill created_by on imported notes
 *   --min-match=0.95     auto-link listings at/above this score (still reported)
 *   --report=path.json
 *
 * After AM/DB/JOB accept invites:
 *   pnpm exec tsx scripts/import-bracketts-wip.mts --account-slug=bracketts --backfill-authors
 *   pnpm exec tsx scripts/import-bracketts-wip.mts --account-slug=bracketts --backfill-authors --write
 *
 * Loads NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SECRET_KEY from apps/web .env*.
 */
import { createClient } from '@supabase/supabase-js';

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

import {
  BRACKETTS_AUTHOR_DIRECTORY,
  BRACKETTS_WIP_IMPORT_SOURCE,
  parseBrackettsWipCsvRows,
  parseCsvMultiline,
  rankListingMatches,
} from '../lib/commercial/bracketts-wip-import.ts';

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
  let write = false;
  let backfillAuthors = false;
  let accountId: string | undefined;
  let accountSlug: string | undefined;
  let csvPath = resolve(
    process.cwd(),
    'scripts/data/bracketts-wip-202605.csv',
  );
  let minMatch = 0.95;
  let reportPath = resolve(
    process.cwd(),
    'scripts/data/bracketts-wip-import-report.json',
  );

  for (const arg of argv) {
    if (arg === '--write') write = true;
    else if (arg === '--backfill-authors') backfillAuthors = true;
    else if (arg.startsWith('--account='))
      accountId = arg.slice('--account='.length).trim() || undefined;
    else if (arg.startsWith('--account-slug='))
      accountSlug = arg.slice('--account-slug='.length).trim() || undefined;
    else if (arg.startsWith('--csv='))
      csvPath = resolve(process.cwd(), arg.slice('--csv='.length));
    else if (arg.startsWith('--min-match=')) {
      const parsed = Number(arg.slice('--min-match='.length));
      if (Number.isFinite(parsed)) minMatch = parsed;
    } else if (arg.startsWith('--report='))
      reportPath = resolve(process.cwd(), arg.slice('--report='.length));
  }

  return {
    write,
    backfillAuthors,
    accountId,
    accountSlug,
    csvPath,
    minMatch,
    reportPath,
  };
}

async function resolveAccountId(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  admin: any,
  accountId: string | undefined,
  accountSlug: string | undefined,
): Promise<{ id: string; slug: string | null; name: string | null }> {
  if (accountId) {
    const { data, error } = await admin
      .from('accounts')
      .select('id, slug, name')
      .eq('id', accountId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) throw new Error(`Account not found: ${accountId}`);
    return data;
  }
  if (!accountSlug) {
    throw new Error('Pass --account=<uuid> or --account-slug=<slug>');
  }
  const { data, error } = await admin
    .from('accounts')
    .select('id, slug, name')
    .eq('slug', accountSlug)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error(`Account slug not found: ${accountSlug}`);
  return data;
}

async function resolveAuthorUserIds(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  admin: any,
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  const emails = BRACKETTS_AUTHOR_DIRECTORY.flatMap((p) => p.emails);

  const { data: accounts, error } = await admin
    .from('accounts')
    .select('id, email, name')
    .eq('is_personal_account', true)
    .in(
      'email',
      emails.map((e) => e.toLowerCase()),
    );

  if (error) {
    console.warn('accounts email lookup failed, falling back to auth admin', error.message);
  } else {
    const byEmail = new Map(
      ((accounts ?? []) as Array<{ id: string; email: string | null }>).map(
        (row) => [(row.email ?? '').toLowerCase(), row.id],
      ),
    );
    for (const person of BRACKETTS_AUTHOR_DIRECTORY) {
      for (const email of person.emails) {
        const id = byEmail.get(email.toLowerCase());
        if (id) {
          map.set(person.token, id);
          break;
        }
      }
    }
  }

  if (map.size >= BRACKETTS_AUTHOR_DIRECTORY.length) return map;

  // Fallback: auth admin list (handles invited users not mirrored on accounts.email)
  let page = 1;
  for (;;) {
    const { data, error: listError } = await admin.auth.admin.listUsers({
      page,
      perPage: 200,
    });
    if (listError) throw new Error(listError.message);
    const users = data.users ?? [];
    if (users.length === 0) break;
    for (const person of BRACKETTS_AUTHOR_DIRECTORY) {
      if (map.has(person.token)) continue;
      const hit = users.find((u: { email?: string | null }) =>
        person.emails.some(
          (email) => (u.email ?? '').toLowerCase() === email.toLowerCase(),
        ),
      );
      if (hit?.id) map.set(person.token, hit.id as string);
    }
    if (users.length < 200) break;
    page += 1;
    if (page > 20) break;
  }

  return map;
}

type ReportRow = {
  importKey: string;
  title: string;
  stage: string;
  workType: string;
  section: string;
  feeGbp: number | null;
  chaseNoteCount: number;
  childLabels: string[];
  listingMatch: null | {
    id: string;
    name: string;
    score: number;
    autoLink: boolean;
  };
  listingCandidates: Array<{ id: string; name: string; score: number }>;
  listingNeedsReview: boolean;
  action: 'create' | 'skip_existing';
  existingDealId?: string;
};

async function main() {
  loadEnvFiles();
  const args = parseArgs(process.argv.slice(2));
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      'Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SECRET_KEY in env',
    );
  }

  if (!existsSync(args.csvPath)) {
    throw new Error(`CSV not found: ${args.csvPath}`);
  }

  const admin = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const account = await resolveAccountId(
    admin,
    args.accountId,
    args.accountSlug,
  );
  console.log(
    `Account: ${account.name ?? account.slug} (${account.id})  mode=${
      args.backfillAuthors
        ? args.write
          ? 'BACKFILL-AUTHORS-WRITE'
          : 'BACKFILL-AUTHORS-DRY-RUN'
        : args.write
          ? 'WRITE'
          : 'DRY-RUN'
    }`,
  );

  const csvText = readFileSync(args.csvPath);
  const rows = parseCsvMultiline(csvText.toString('latin1'));
  const instructions = parseBrackettsWipCsvRows(rows);
  console.log(`Parsed instructions: ${instructions.length}`);

  const authorIds = await resolveAuthorUserIds(admin);
  console.log(
    'Resolved authors:',
    [...authorIds.entries()].map(([token, id]) => `${token}=${id.slice(0, 8)}…`),
  );
  for (const person of BRACKETTS_AUTHOR_DIRECTORY) {
    if (!authorIds.has(person.token)) {
      console.warn(
        `  ! ${person.token} (${person.name}) not found by email yet — accept invite / create profile first`,
      );
    }
  }

  if (args.backfillAuthors) {
    const authorByImportKey = new Map<string, string>();
    for (const instr of instructions) {
      for (const note of instr.chaseNotes) {
        if (note.authorToken) {
          authorByImportKey.set(note.importKey, note.authorToken);
        }
      }
    }

    const { data: notes, error: notesError } = await admin
      .from('notes')
      .select('id, content, created_by, pipeline_deal_id')
      .eq('account_id', account.id)
      .like('content', '[import_key:%')
      .is('created_by', null)
      .limit(5000);

    if (notesError) throw new Error(notesError.message);

    let wouldUpdate = 0;
    let updated = 0;
    let unresolved = 0;
    const byToken: Record<string, number> = {};

    for (const note of (notes ?? []) as Array<{
      id: string;
      content: string | null;
    }>) {
      const key = note.content?.match(/^\[import_key:([^\]]+)\]/)?.[1];
      if (!key) continue;
      const token = authorByImportKey.get(key);
      if (!token) continue;
      const userId = authorIds.get(token);
      if (!userId) {
        unresolved += 1;
        continue;
      }
      wouldUpdate += 1;
      byToken[token] = (byToken[token] ?? 0) + 1;
      if (!args.write) continue;

      const { error: updateError } = await admin
        .from('notes')
        .update({ created_by: userId, user_id: userId })
        .eq('id', note.id)
        .is('created_by', null);

      if (updateError) {
        console.error(`  failed note ${note.id}: ${updateError.message}`);
        continue;
      }
      updated += 1;
    }

    console.log(
      `Author backfill: candidates=${wouldUpdate} unresolved_token=${unresolved} byToken=${JSON.stringify(byToken)}`,
    );
    if (!args.write) {
      console.log(
        'Dry-run only. Re-run with --backfill-authors --write after members have accepted.',
      );
    } else {
      console.log(`Updated notes: ${updated}`);
    }
    return;
  }

  const { data: listings, error: listingError } = await admin
    .from('commercial_listings')
    .select('id, name')
    .eq('account_id', account.id);
  if (listingError) throw new Error(listingError.message);

  const { data: allDeals } = await admin
    .from('pipeline_deals')
    .select('id, notes, name, company_name, source')
    .eq('account_id', account.id);

  const existingByImportKey = new Map<string, string>();
  for (const deal of (allDeals ?? []) as Array<{
    id: string;
    notes: string | null;
    source: string | null;
  }>) {
    const match = deal.notes?.match(/\[import_key:([^\]]+)\]/);
    if (match?.[1]) existingByImportKey.set(match[1], deal.id);
  }

  const listingRows = (listings ?? []) as Array<{ id: string; name: string }>;
  const report: ReportRow[] = [];

  for (const instr of instructions) {
    const candidates = rankListingMatches(instr.title, listingRows, 3);
    const best = candidates[0] ?? null;
    const autoLink = Boolean(best && best.score >= args.minMatch);
    const existingDealId = existingByImportKey.get(instr.importKey);

    report.push({
      importKey: instr.importKey,
      title: instr.title,
      stage: instr.stage,
      workType: instr.workType,
      section: instr.section,
      feeGbp: instr.feeGbp,
      chaseNoteCount: instr.chaseNotes.length,
      childLabels: instr.childLabels,
      listingMatch: best
        ? {
            id: best.id,
            name: best.name,
            score: Number(best.score.toFixed(3)),
            autoLink,
          }
        : null,
      listingCandidates: candidates.map((c) => ({
        id: c.id,
        name: c.name,
        score: Number(c.score.toFixed(3)),
      })),
      listingNeedsReview: Boolean(
        best && !autoLink && best.score >= 0.55,
      ),
      action: existingDealId ? 'skip_existing' : 'create',
      existingDealId,
    });
  }

  mkdirSync(dirname(args.reportPath), { recursive: true });
  writeFileSync(
    args.reportPath,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        account,
        mode: args.write ? 'write' : 'dry-run',
        minMatch: args.minMatch,
        totals: {
          instructions: report.length,
          create: report.filter((r) => r.action === 'create').length,
          skipExisting: report.filter((r) => r.action === 'skip_existing')
            .length,
          autoLinked: report.filter((r) => r.listingMatch?.autoLink).length,
          needsReview: report.filter((r) => r.listingNeedsReview).length,
          withCandidates: report.filter((r) => r.listingCandidates.length > 0)
            .length,
          chaseNotes: report.reduce((sum, r) => sum + r.chaseNoteCount, 0),
        },
        authorResolution: Object.fromEntries(
          BRACKETTS_AUTHOR_DIRECTORY.map((p) => [
            p.token,
            authorIds.get(p.token) ?? null,
          ]),
        ),
        rows: report,
      },
      null,
      2,
    ),
  );
  console.log(`Report written: ${args.reportPath}`);
  console.log(
    `Summary: create=${report.filter((r) => r.action === 'create').length} skip=${report.filter((r) => r.action === 'skip_existing').length} autoLink=${report.filter((r) => r.listingMatch?.autoLink).length} notes=${report.reduce((s, r) => s + r.chaseNoteCount, 0)}`,
  );

  if (!args.write) {
    console.log('Dry-run only. Re-run with --write after reviewing the report.');
    return;
  }

  const { data: existingClients } = await admin
    .from('clients')
    .select('id, company_name, display_name')
    .eq('account_id', account.id)
    .is('archived_at', null);

  const clientsByName = new Map<string, string>();
  for (const client of existingClients ?? []) {
    for (const raw of [client.company_name, client.display_name]) {
      const key = raw?.trim().toLowerCase();
      if (key && !clientsByName.has(key)) clientsByName.set(key, client.id);
    }
  }

  let created = 0;
  let notesCreated = 0;
  let skipped = 0;
  let createdClients = 0;
  let createdContacts = 0;

  async function ensureLandlordClient(label: string): Promise<string | null> {
    const nameKey = label.toLowerCase();
    const existing = clientsByName.get(nameKey);
    if (existing) return existing;

    const { data, error } = await admin
      .from('clients')
      .insert({
        account_id: account.id,
        client_type: 'business',
        company_name: label,
        display_name: label,
        commercial_role: 'landlord',
      })
      .select('id')
      .single();
    if (error || !data) {
      console.error(`Client failed ${label}:`, error?.message);
      return null;
    }
    clientsByName.set(nameKey, data.id);
    createdClients += 1;
    return data.id as string;
  }

  async function ensureLandlordContact(
    label: string,
    dealId: string,
    clientId: string | null,
  ): Promise<void> {
    const importKey = `${BRACKETTS_WIP_IMPORT_SOURCE}:deal:${dealId}`;
    const { data: existing } = await admin
      .from('contacts')
      .select('id')
      .eq('account_id', account.id)
      .ilike('notes', `%[import_key:${importKey}]%`)
      .maybeSingle();

    let contactId = existing?.id as string | undefined;
    if (!contactId) {
      const { data, error } = await admin
        .from('contacts')
        .insert({
          account_id: account.id,
          full_name: label,
          notes: `[import_key:${importKey}]\nLandlord / instructing party from WIP instruction`,
        })
        .select('id')
        .single();
      if (error || !data) {
        console.error(`Contact failed ${label}:`, error?.message);
        return;
      }
      contactId = data.id as string;
      createdContacts += 1;
    }

    if (clientId && contactId) {
      await admin.from('client_contacts').upsert(
        {
          client_id: clientId,
          contact_id: contactId,
          is_primary: true,
        },
        { onConflict: 'client_id,contact_id' },
      );
    }
  }

  for (const instr of instructions) {
    const existingDealId = existingByImportKey.get(instr.importKey);
    if (existingDealId) {
      skipped += 1;
      continue;
    }

    const row = report.find((r) => r.importKey === instr.importKey)!;
    const listingId = row.listingMatch?.autoLink
      ? row.listingMatch.id
      : null;

    const metaBits = [
      `[import_key:${instr.importKey}]`,
      `Section: ${instr.section}`,
      instr.propertyMeta ? `Meta: ${instr.propertyMeta}` : null,
      instr.childLabels.length
        ? `Children:\n- ${instr.childLabels.join('\n- ')}`
        : null,
    ]
      .filter(Boolean)
      .join('\n');

    const landlordLabel = instr.title.trim();
    const clientId = await ensureLandlordClient(landlordLabel);

    const { data: deal, error: insertError } = await admin
      .from('pipeline_deals')
      .insert({
        account_id: account.id,
        name: instr.title,
        company_name: landlordLabel,
        contact_name: landlordLabel,
        client_id: clientId,
        value: instr.feeGbp ?? 0,
        stage: instr.stage,
        work_type: instr.workType,
        source: BRACKETTS_WIP_IMPORT_SOURCE,
        notes: metaBits,
        commercial_listing_id: listingId,
        completed_at:
          instr.stage === 'completed_exchanged'
            ? new Date().toISOString()
            : null,
      })
      .select('id')
      .single();

    if (insertError) {
      console.error(`Failed deal ${instr.title}:`, insertError.message);
      continue;
    }

    created += 1;
    const dealId = deal.id as string;
    existingByImportKey.set(instr.importKey, dealId);
    await ensureLandlordContact(landlordLabel, dealId, clientId);

    // Child labels as activity notes (one each) when no chase text
    const childNotes = instr.childLabels.map((label, index) => ({
      importKey: `${instr.importKey}:child-label:${index}`,
      dateIso: null as string | null,
      authorToken: null as string | null,
      body: `Checklist / child item: ${label}`,
    }));

    const allNotes = [
      ...instr.chaseNotes.map((n) => ({
        importKey: n.importKey,
        dateIso: n.dateIso,
        authorToken: n.authorToken,
        body: n.body,
      })),
      ...childNotes,
    ];

    for (const note of allNotes) {
      const createdBy = note.authorToken
        ? (authorIds.get(note.authorToken) ?? null)
        : null;
      const createdAt = note.dateIso ?? new Date().toISOString();
      const content = `[import_key:${note.importKey}]\n${note.body}`;
      const { error: noteError } = await admin.from('notes').insert({
        account_id: account.id,
        title: '',
        content,
        category: 'idea',
        created_by: createdBy,
        user_id: createdBy,
        pipeline_deal_id: dealId,
        created_at: createdAt,
        updated_at: createdAt,
      });

      if (noteError) {
        console.error(`  note failed on ${instr.title}: ${noteError.message}`);
        continue;
      }
      notesCreated += 1;
    }
  }

  console.log(
    `Write complete: deals_created=${created} skipped=${skipped} notes_created=${notesCreated} clients=${createdClients} contacts=${createdContacts}`,
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
