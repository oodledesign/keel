#!/usr/bin/env node
/**
 * Backfill clients + contacts from Bracketts WIP instructions.
 *
 * The WIP CSV has property/instruction titles, not person emails — so each
 * instruction becomes a landlord client + primary contact, then the deal is
 * linked via client_id / contact_name.
 *
 * Dry-run:
 *   pnpm exec tsx scripts/backfill-bracketts-wip-contacts.mts --account-slug=bracketts
 *
 * Write:
 *   pnpm exec tsx scripts/backfill-bracketts-wip-contacts.mts --account-slug=bracketts --write
 */
import { createClient } from '@supabase/supabase-js';

import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { BRACKETTS_WIP_IMPORT_SOURCE } from '../lib/commercial/bracketts-wip-import.ts';

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

function contactImportKey(dealId: string) {
  return `${BRACKETTS_WIP_IMPORT_SOURCE}:deal:${dealId}`;
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

  const { data: deals, error: dealsError } = await admin
    .from('pipeline_deals')
    .select('id, name, company_name, contact_name, client_id, notes')
    .eq('account_id', account.id)
    .eq('source', BRACKETTS_WIP_IMPORT_SOURCE)
    .order('name');

  if (dealsError) throw new Error(dealsError.message);

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

  const { data: existingContacts } = await admin
    .from('contacts')
    .select('id, full_name, notes')
    .eq('account_id', account.id);

  const contactsByImportKey = new Map<string, string>();
  const contactsByName = new Map<string, string>();
  for (const contact of existingContacts ?? []) {
    const keyMatch = String(contact.notes ?? '').match(
      /\[import_key:([^\]]+)\]/,
    );
    if (keyMatch?.[1]) contactsByImportKey.set(keyMatch[1], contact.id);
    const nameKey = contact.full_name?.trim().toLowerCase();
    if (nameKey && !contactsByName.has(nameKey)) {
      contactsByName.set(nameKey, contact.id);
    }
  }

  let createdClients = 0;
  let createdContacts = 0;
  let linkedDeals = 0;
  let skipped = 0;
  let samples = 0;

  for (const deal of deals ?? []) {
    const label =
      deal.company_name?.trim() || deal.name?.trim() || `Instruction ${deal.id}`;
    const nameKey = label.toLowerCase();
    const importKey = contactImportKey(deal.id);

    if (deal.client_id && deal.contact_name?.trim()) {
      skipped += 1;
      continue;
    }

    if (!write) {
      if (samples < 5) {
        console.log('sample', {
          dealId: deal.id,
          label,
          alreadyClient: clientsByName.has(nameKey),
          alreadyContact:
            contactsByImportKey.has(importKey) || contactsByName.has(nameKey),
        });
        samples += 1;
      }
      linkedDeals += 1;
      continue;
    }

    let clientId = deal.client_id as string | null;
    if (!clientId) {
      clientId = clientsByName.get(nameKey) ?? null;
    }
    if (!clientId) {
      const { data: client, error } = await admin
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
      if (error || !client) {
        console.error(`Client failed ${label}:`, error?.message);
        skipped += 1;
        continue;
      }
      clientId = client.id as string;
      clientsByName.set(nameKey, clientId);
      createdClients += 1;
    }

    let contactId =
      contactsByImportKey.get(importKey) ?? contactsByName.get(nameKey) ?? null;
    if (!contactId) {
      const { data: contact, error } = await admin
        .from('contacts')
        .insert({
          account_id: account.id,
          full_name: label,
          notes: `[import_key:${importKey}]\nLandlord / instructing party from WIP instruction`,
        })
        .select('id')
        .single();
      if (error || !contact) {
        console.error(`Contact failed ${label}:`, error?.message);
        skipped += 1;
        continue;
      }
      contactId = contact.id as string;
      contactsByImportKey.set(importKey, contactId);
      contactsByName.set(nameKey, contactId);
      createdContacts += 1;
    }

    const { error: linkError } = await admin.from('client_contacts').upsert(
      {
        client_id: clientId,
        contact_id: contactId,
        is_primary: true,
      },
      { onConflict: 'client_id,contact_id' },
    );
    if (linkError && !/duplicate|unique/i.test(linkError.message)) {
      console.error(`Link failed ${label}:`, linkError.message);
    }

    const { error: dealError } = await admin
      .from('pipeline_deals')
      .update({
        client_id: clientId,
        company_name: label,
        contact_name: label,
      })
      .eq('id', deal.id)
      .eq('account_id', account.id);

    if (dealError) {
      console.error(`Deal link failed ${label}:`, dealError.message);
      skipped += 1;
      continue;
    }

    linkedDeals += 1;
  }

  console.log(
    JSON.stringify(
      {
        accountSlug,
        write,
        deals: deals?.length ?? 0,
        createdClients,
        createdContacts,
        linkedDeals,
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
