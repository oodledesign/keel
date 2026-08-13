#!/usr/bin/env node
/**
 * Import Bracketts requirements sheet → clients (businesses), contacts, commercial_requirements.
 *
 * Dry-run:
 *   pnpm exec tsx scripts/import-bracketts-requirements.mts --account-slug=bracketts
 *
 * Write:
 *   pnpm exec tsx scripts/import-bracketts-requirements.mts --account-slug=bracketts --write
 */
import { createClient } from '@supabase/supabase-js';

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

import {
  BRACKETTS_REQUIREMENTS_IMPORT_SOURCE,
  parseBrackettsRequirementsCsv,
  requirementSectorLabel,
  type ParsedRequirementRow,
} from '../lib/commercial/bracketts-requirements-import.ts';

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
  let accountId: string | undefined;
  let accountSlug: string | undefined;
  let csvPath = resolve(
    process.cwd(),
    'scripts/data/bracketts-requirements-full.csv',
  );
  let reportPath = resolve(
    process.cwd(),
    'scripts/data/bracketts-requirements-import-report.json',
  );

  for (const arg of argv) {
    if (arg === '--write') write = true;
    else if (arg.startsWith('--account='))
      accountId = arg.slice('--account='.length).trim() || undefined;
    else if (arg.startsWith('--account-slug='))
      accountSlug = arg.slice('--account-slug='.length).trim() || undefined;
    else if (arg.startsWith('--csv='))
      csvPath = resolve(process.cwd(), arg.slice('--csv='.length).trim());
    else if (arg.startsWith('--report='))
      reportPath = resolve(process.cwd(), arg.slice('--report='.length).trim());
  }

  return { write, accountId, accountSlug, csvPath, reportPath };
}

function splitName(full: string | null): {
  first: string | null;
  last: string | null;
  full: string | null;
} {
  if (!full?.trim()) return { first: null, last: null, full: null };
  const parts = full.trim().split(/\s+/);
  if (parts.length === 1) return { first: parts[0]!, last: null, full };
  return {
    first: parts[0]!,
    last: parts.slice(1).join(' '),
    full: full.trim(),
  };
}

async function main() {
  loadEnvFiles();
  const args = parseArgs(process.argv.slice(2));
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SECRET_KEY');
  }

  const admin = createClient(url, key, { auth: { persistSession: false } });

  let account: { id: string; name: string; slug: string | null } | null = null;
  if (args.accountId) {
    const { data, error } = await admin
      .from('accounts')
      .select('id, name, slug')
      .eq('id', args.accountId)
      .maybeSingle();
    if (error) throw error;
    account = data;
  } else if (args.accountSlug) {
    const { data, error } = await admin
      .from('accounts')
      .select('id, name, slug')
      .eq('slug', args.accountSlug)
      .maybeSingle();
    if (error) throw error;
    account = data;
  } else {
    throw new Error('Pass --account=<uuid> or --account-slug=<slug>');
  }

  if (!account) throw new Error('Account not found');

  const csvText = readFileSync(args.csvPath, 'utf8');
  const rows = parseBrackettsRequirementsCsv(csvText);

  console.log(
    `Account: ${account.name} (${account.id})  mode=${args.write ? 'WRITE' : 'DRY-RUN'}`,
  );
  console.log(`Parsed requirements: ${rows.length}`);

  const byUse = new Map<string, number>();
  for (const row of rows) {
    const key = row.useClass ?? 'unknown';
    byUse.set(key, (byUse.get(key) ?? 0) + 1);
  }
  console.log('Use-class counts:', Object.fromEntries(byUse));

  mkdirSync(dirname(args.reportPath), { recursive: true });
  writeFileSync(
    args.reportPath,
    JSON.stringify(
      {
        accountId: account.id,
        source: BRACKETTS_REQUIREMENTS_IMPORT_SOURCE,
        parsed: rows.length,
        byUseClass: Object.fromEntries(byUse),
        sample: rows.slice(0, 20),
      },
      null,
      2,
    ),
  );
  console.log(`Report written: ${args.reportPath}`);

  if (!args.write) {
    console.log('Dry-run only. Re-run with --write after reviewing the report.');
    return;
  }

  const { data: existingReqs } = await admin
    .from('commercial_requirements')
    .select('id, notes, source')
    .eq('account_id', account.id)
    .eq('source', BRACKETTS_REQUIREMENTS_IMPORT_SOURCE);

  const existingKeys = new Set<string>();
  for (const req of existingReqs ?? []) {
    const match = String(req.notes ?? '').match(/\[import_key:([^\]]+)\]/);
    if (match?.[1]) existingKeys.add(match[1]);
  }

  const { data: existingClients } = await admin
    .from('clients')
    .select('id, company_name, display_name, email, client_type')
    .eq('account_id', account.id)
    .is('archived_at', null);

  const clientsByCompany = new Map<string, string>();
  const clientsByEmail = new Map<string, string>();
  for (const c of existingClients ?? []) {
    if (c.company_name?.trim()) {
      clientsByCompany.set(c.company_name.trim().toLowerCase(), c.id);
    }
    if (c.email?.trim()) {
      clientsByEmail.set(c.email.trim().toLowerCase(), c.id);
    }
  }

  const { data: existingContacts } = await admin
    .from('contacts')
    .select('id, email, full_name, phone')
    .eq('account_id', account.id);

  const contactsByEmail = new Map<string, string>();
  for (const c of existingContacts ?? []) {
    if (c.email?.trim()) {
      contactsByEmail.set(c.email.trim().toLowerCase(), c.id);
    }
  }

  let createdClients = 0;
  let createdContacts = 0;
  let createdReqs = 0;
  let skipped = 0;

  async function ensureClient(row: ParsedRequirementRow): Promise<string | null> {
    if (row.companyName?.trim()) {
      const key = row.companyName.trim().toLowerCase();
      const existing = clientsByCompany.get(key);
      if (existing) return existing;

      const { data, error } = await admin
        .from('clients')
        .insert({
          account_id: account!.id,
          client_type: 'business',
          company_name: row.companyName.trim(),
          display_name: row.companyName.trim(),
          email: row.email,
          phone: row.phone,
          commercial_role: 'tenant',
        })
        .select('id')
        .single();

      if (error) {
        console.error(`Client failed ${row.companyName}:`, error.message);
        return null;
      }
      clientsByCompany.set(key, data.id);
      if (row.email) clientsByEmail.set(row.email, data.id);
      createdClients += 1;
      return data.id as string;
    }

    if (row.email && clientsByEmail.has(row.email)) {
      return clientsByEmail.get(row.email)!;
    }

    if (row.contactName?.trim() || row.email) {
      const name = splitName(row.contactName);
      const display =
        name.full || row.email || row.phone || `Applicant ${row.rowIndex}`;
      const { data, error } = await admin
        .from('clients')
        .insert({
          account_id: account!.id,
          client_type: 'individual',
          first_name: name.first,
          last_name: name.last,
          display_name: display,
          email: row.email,
          phone: row.phone,
          commercial_role: 'tenant',
        })
        .select('id')
        .single();

      if (error) {
        console.error(`Individual client failed ${display}:`, error.message);
        return null;
      }
      if (row.email) clientsByEmail.set(row.email, data.id);
      createdClients += 1;
      return data.id as string;
    }

    return null;
  }

  async function ensureContact(
    row: ParsedRequirementRow,
    clientId: string | null,
  ): Promise<string | null> {
    if (!row.contactName?.trim() && !row.email && !row.phone) return null;

    if (row.email && contactsByEmail.has(row.email)) {
      const contactId = contactsByEmail.get(row.email)!;
      if (clientId) {
        await admin.from('client_contacts').upsert(
          {
            client_id: clientId,
            contact_id: contactId,
            is_primary: true,
          },
          { onConflict: 'client_id,contact_id' },
        );
      }
      return contactId;
    }

    const name = splitName(row.contactName);
    const fullName =
      name.full || row.email || row.phone || `Contact ${row.rowIndex}`;

    const { data, error } = await admin
      .from('contacts')
      .insert({
        account_id: account!.id,
        full_name: fullName,
        first_name: name.first,
        last_name: name.last,
        email: row.email,
        phone: row.phone,
        notes: `[import_key:${row.importKey}]`,
      })
      .select('id')
      .single();

    if (error) {
      console.error(`Contact failed ${fullName}:`, error.message);
      return null;
    }

    if (row.email) contactsByEmail.set(row.email, data.id);
    createdContacts += 1;

    if (clientId) {
      const { error: linkError } = await admin.from('client_contacts').insert({
        client_id: clientId,
        contact_id: data.id,
        is_primary: true,
      });
      if (linkError && !/duplicate|unique/i.test(linkError.message)) {
        console.error(`Link contact failed:`, linkError.message);
      }
    }

    return data.id as string;
  }

  for (const row of rows) {
    if (existingKeys.has(row.importKey)) {
      skipped += 1;
      continue;
    }

    const clientId = await ensureClient(row);
    const contactId = await ensureContact(row, clientId);

    const noteBits = [
      `[import_key:${row.importKey}]`,
      row.useRaw ? `Use: ${row.useRaw}` : null,
      row.detailsSent ? `Details sent: ${row.detailsSent}` : null,
      row.sizeRaw ? `Size: ${row.sizeRaw}` : null,
      row.notes,
    ]
      .filter(Boolean)
      .join('\n');

    const { error } = await admin.from('commercial_requirements').insert({
      account_id: account.id,
      client_id: clientId,
      contact_id: contactId,
      contact_name: row.contactName,
      contact_email: row.email,
      contact_phone: row.phone,
      company_name: row.companyName,
      sector: requirementSectorLabel(row),
      use_class: row.useClass,
      tenure: row.tenure,
      location_text: row.locationText,
      size_min_sqft: row.sizeMinSqft,
      size_max_sqft: row.sizeMaxSqft,
      stage: 'new',
      notes: noteBits,
      source: BRACKETTS_REQUIREMENTS_IMPORT_SOURCE,
      created_at: row.dateIso ?? new Date().toISOString(),
      updated_at: row.dateIso ?? new Date().toISOString(),
    });

    if (error) {
      console.error(
        `Requirement failed row ${row.rowIndex} (${row.companyName ?? row.contactName}):`,
        error.message,
      );
      continue;
    }

    existingKeys.add(row.importKey);
    createdReqs += 1;
  }

  console.log(
    `Write complete: clients=${createdClients} contacts=${createdContacts} requirements=${createdReqs} skipped=${skipped}`,
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
