#!/usr/bin/env node
/**
 * Point every commercial requirement at a contact, so circulation takes the
 * address from the contact record. Safe to re-run.
 *
 * - Website-form requirements with no contact: link to a contact with the
 *   same email, otherwise create one (and link their circulation consent).
 * - Linked requirements with no email: copy the contact's email.
 * - Requirement email differs from the contact's: report only.
 *
 * Dry-run (default, writes nothing):
 *   pnpm exec tsx scripts/backfill-requirement-contacts.mts --account-slug=bracketts
 *
 * Write:
 *   pnpm exec tsx scripts/backfill-requirement-contacts.mts --account-slug=bracketts --write
 */
import { createClient } from '@supabase/supabase-js';

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

import {
  type BackfillAction,
  planRequirementContactBackfill,
} from '../lib/commercial/requirement-contact-backfill.ts';

const BACKFILL_TAG = '[backfill:requirement-contacts]';

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
  let reportPath = resolve(
    process.cwd(),
    'scripts/data/requirement-contacts-backfill-report.json',
  );
  for (const arg of argv) {
    if (arg === '--write') write = true;
    else if (arg.startsWith('--account='))
      accountId = arg.slice('--account='.length).trim() || undefined;
    else if (arg.startsWith('--account-slug='))
      accountSlug = arg.slice('--account-slug='.length).trim() || undefined;
    else if (arg.startsWith('--report='))
      reportPath = resolve(process.cwd(), arg.slice('--report='.length).trim());
  }
  return { write, accountId, accountSlug, reportPath };
}

function splitName(full: string | null) {
  if (!full?.trim()) return { first: null, last: null };
  const parts = full.trim().split(/\s+/);
  return {
    first: parts[0] ?? null,
    last: parts.length > 1 ? parts.slice(1).join(' ') : null,
  };
}

async function fetchAll<T>(
  fetchPage: (
    from: number,
    to: number,
  ) => PromiseLike<{ data: unknown; error: { message: string } | null }>,
): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await fetchPage(from, from + 999);
    if (error) throw new Error(error.message);
    const page = (data ?? []) as T[];
    rows.push(...page);
    if (page.length < 1000) return rows;
  }
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
  if (!args.accountId && !args.accountSlug) {
    throw new Error('Pass --account-slug=<slug> or --account=<uuid>');
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin: any = createClient(url, key, {
    auth: { persistSession: false },
  });

  const accountQuery = admin.from('accounts').select('id, name, slug');
  const { data: account, error: accountError } = await (
    args.accountId
      ? accountQuery.eq('id', args.accountId)
      : accountQuery.eq('slug', args.accountSlug)
  ).maybeSingle();
  if (accountError) throw new Error(accountError.message);
  if (!account) throw new Error('Account not found');
  const accountId = account.id as string;

  const [requirements, clients, people] = await Promise.all([
    fetchAll<Record<string, string | null>>((from, to) =>
      admin
        .from('commercial_requirements')
        .select(
          'id, client_id, contact_id, contact_email, contact_name, contact_phone, company_name',
        )
        .eq('account_id', accountId)
        .order('created_at', { ascending: true })
        .range(from, to),
    ),
    fetchAll<Record<string, string | null>>((from, to) =>
      admin
        .from('clients')
        .select('id, email, display_name')
        .eq('account_id', accountId)
        .is('archived_at', null)
        .range(from, to),
    ),
    fetchAll<Record<string, string | null>>((from, to) =>
      admin
        .from('contacts')
        .select('id, email, client_id')
        .eq('account_id', accountId)
        .range(from, to),
    ),
  ]);

  const clientIds = clients.map((c) => c.id as string);
  const links: Array<{ contactId: string; clientId: string }> = [];
  for (let i = 0; i < clientIds.length; i += 200) {
    const { data, error } = await admin
      .from('client_contacts')
      .select('client_id, contact_id')
      .in('client_id', clientIds.slice(i, i + 200));
    if (error) throw new Error(error.message);
    for (const row of data ?? []) {
      links.push({ contactId: row.contact_id, clientId: row.client_id });
    }
  }

  const plan = planRequirementContactBackfill({
    requirements: requirements.map((r) => ({
      id: r.id as string,
      clientId: r.client_id,
      contactId: r.contact_id,
      contactEmail: r.contact_email,
      contactName: r.contact_name,
      contactPhone: r.contact_phone,
      companyName: r.company_name,
    })),
    clients: clients.map((c) => ({
      id: c.id as string,
      email: c.email,
      displayName: c.display_name,
    })),
    people: people.map((p) => ({
      id: p.id as string,
      email: p.email,
      clientId: p.client_id,
    })),
    personClientLinks: links,
  });

  mkdirSync(dirname(args.reportPath), { recursive: true });
  writeFileSync(
    args.reportPath,
    JSON.stringify(
      {
        account: { id: accountId, name: account.name, slug: account.slug },
        generatedAt: new Date().toISOString(),
        mode: args.write ? 'write' : 'dry-run',
        requirements: requirements.length,
        counts: plan.counts,
        actions: plan.actions,
      },
      null,
      2,
    ),
  );

  console.log(`Account: ${account.name} (${account.slug ?? accountId})`);
  console.log(`Requirements: ${requirements.length}`);
  console.log(`  Link to an existing contact:   ${plan.counts.link_existing}`);
  console.log(`  Create a new contact:          ${plan.counts.create_contact}`);
  console.log(
    `    of which may duplicate:      ${
      plan.actions.filter(
        (a) => a.kind === 'create_contact' && a.possibleDuplicates.length > 0,
      ).length
    }`,
  );
  console.log(`  Fill email from contact:       ${plan.counts.fill_email}`);
  console.log(`  Email differs (report only):   ${plan.counts.mismatch}`);
  console.log(`  No email or name (skipped):    ${plan.counts.unlinkable}`);
  console.log(`Report: ${args.reportPath}`);

  if (!args.write) {
    console.log(
      '\nDry run. Nothing was written. Re-run with --write to apply.',
    );
    return;
  }

  const createdByKey = new Map<
    string,
    { clientId: string; contactId: string }
  >();
  let applied = 0;

  async function createContact(
    action: Extract<BackfillAction, { kind: 'create_contact' }>,
  ) {
    const key = action.email ?? `name:${action.name?.toLowerCase()}`;
    const existing = createdByKey.get(key);
    if (existing) return existing;

    const name = splitName(action.name);
    const display =
      action.companyName || action.name || action.email || 'Applicant';
    const { data: client, error: clientError } = await admin
      .from('clients')
      .insert({
        account_id: accountId,
        client_type: action.companyName ? 'business' : 'individual',
        company_name: action.companyName,
        first_name: action.companyName ? null : name.first,
        last_name: action.companyName ? null : name.last,
        display_name: display,
        email: action.email,
        phone: action.phone,
        commercial_role: 'tenant',
      })
      .select('id')
      .single();
    if (clientError) throw new Error(clientError.message);

    const { data: person, error: personError } = await admin
      .from('contacts')
      .insert({
        account_id: accountId,
        client_id: client.id,
        full_name: action.name || action.email || display,
        first_name: name.first,
        last_name: name.last,
        email: action.email,
        phone: action.phone,
        is_primary: true,
        notes: BACKFILL_TAG,
      })
      .select('id')
      .single();
    if (personError) throw new Error(personError.message);

    const { error: linkError } = await admin
      .from('client_contacts')
      .insert({
        client_id: client.id,
        contact_id: person.id,
        is_primary: true,
      });
    if (linkError && !/duplicate|unique/i.test(linkError.message)) {
      throw new Error(linkError.message);
    }

    const created = {
      clientId: client.id as string,
      contactId: person.id as string,
    };
    createdByKey.set(key, created);
    return created;
  }

  async function linkConsent(email: string | null, clientId: string) {
    if (!email) return;
    for (const table of [
      'commercial_marketing_preferences',
      'workspace_mailing_preferences',
    ]) {
      const { error } = await admin
        .from(table)
        .update({ client_id: clientId })
        .eq('account_id', accountId)
        .eq('email', email)
        .is('client_id', null);
      if (error) throw new Error(`${table}: ${error.message}`);
    }
  }

  for (const action of plan.actions) {
    try {
      if (action.kind === 'link_existing') {
        const patch: Record<string, string> = { client_id: action.clientId };
        if (action.contactId) patch.contact_id = action.contactId;
        const { error } = await admin
          .from('commercial_requirements')
          .update(patch)
          .eq('id', action.requirementId)
          .eq('account_id', accountId)
          .is('client_id', null);
        if (error) throw new Error(error.message);
        const req = requirements.find((r) => r.id === action.requirementId);
        await linkConsent(
          req?.contact_email?.trim().toLowerCase() ?? null,
          action.clientId,
        );
        applied += 1;
      } else if (action.kind === 'create_contact') {
        const created = await createContact(action);
        const { error } = await admin
          .from('commercial_requirements')
          .update({
            client_id: created.clientId,
            contact_id: created.contactId,
          })
          .eq('id', action.requirementId)
          .eq('account_id', accountId)
          .is('client_id', null);
        if (error) throw new Error(error.message);
        await linkConsent(action.email, created.clientId);
        applied += 1;
      } else if (action.kind === 'fill_email') {
        const { error } = await admin
          .from('commercial_requirements')
          .update({ contact_email: action.email })
          .eq('id', action.requirementId)
          .eq('account_id', accountId)
          .is('contact_email', null);
        if (error) throw new Error(error.message);
        applied += 1;
      }
    } catch (err) {
      console.error(
        `Failed ${action.kind} for requirement ${action.requirementId}:`,
        err instanceof Error ? err.message : err,
      );
    }
  }

  console.log(
    `\nWrite complete: ${applied} requirement(s) updated, ${createdByKey.size} contact(s) created.`,
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
