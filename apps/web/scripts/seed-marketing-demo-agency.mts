#!/usr/bin/env node
/**
 * Seed a local commercial workspace with fictional agency data for marketing
 * screenshots (see apps/e2e/scripts/capture-marketing-screens.ts).
 *
 * Local Supabase only — refuses to run against any non-localhost URL.
 *
 *   1. pnpm supabase:web:start, pnpm dev, sign up and create a Commercial
 *      Property workspace (e.g. slug "harland-reed").
 *   2. pnpm exec tsx scripts/seed-marketing-demo-agency.mts --account-slug=harland-reed
 *   3. Add --write to apply. Re-running replaces the previous demo rows.
 *
 * Loads NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SECRET_KEY from apps/web .env*.
 */
import { createClient } from '@supabase/supabase-js';

import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const DEMO_REF_PREFIX = 'OZD-';
const DEMO_SOURCE = 'ozer-demo';

function loadEnv() {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  for (const file of [
    resolve(root, '.env'),
    resolve(root, '.env.development'),
    resolve(root, '.env.local'),
  ]) {
    if (!existsSync(file)) continue;
    for (const line of readFileSync(file, 'utf8').split('\n')) {
      const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (!match) continue;
      const key = match[1]!;
      const value = match[2]!.replace(/^['"]|['"]$/g, '');
      if (process.env[key] == null || process.env[key] === '') {
        process.env[key] = value;
      }
    }
  }
}

function parseArgs(argv: string[]) {
  const get = (name: string) =>
    argv.find((a) => a.startsWith(`--${name}=`))?.split('=')[1];
  const accountSlug = get('account-slug');
  if (!accountSlug) throw new Error('Pass --account-slug=<slug>');
  return { accountSlug, write: argv.includes('--write') };
}

function assertLocal(url: string) {
  const host = new URL(url).hostname;
  if (host !== '127.0.0.1' && host !== 'localhost') {
    throw new Error(
      `Refusing to seed demo data into ${host}. Point NEXT_PUBLIC_SUPABASE_URL at local Supabase.`,
    );
  }
}

const pounds = (value: number) => value * 100;

const LISTINGS = [
  {
    ref: 'OZD-101',
    name: 'Unit 7, Hawthorn Business Park',
    address_line_1: 'Unit 7, Hawthorn Business Park',
    town: 'Maidstone',
    postcode: 'ME16 0XA',
    disposal_type: 'to_let',
    status: 'marketing',
    asking_rent_pence: pounds(38_500),
    size_min_sqft: 4_820,
    size_max_sqft: 4_820,
    use_class: 'B8',
    sector: 'industrial',
    summary:
      'Detached warehouse with 6.5m eaves, one level-access loading door and 12 parking spaces.',
    brochure: true,
  },
  {
    ref: 'OZD-102',
    name: '14 Calverley Street',
    address_line_1: '14 Calverley Street',
    town: 'Tunbridge Wells',
    postcode: 'TN1 2XF',
    disposal_type: 'to_let',
    status: 'marketing',
    asking_rent_pence: pounds(27_000),
    size_min_sqft: 1_150,
    size_max_sqft: 1_150,
    use_class: 'E',
    sector: 'retail',
    summary: 'Ground floor shop with rear store, 6.1m frontage.',
    brochure: false,
  },
  {
    ref: 'OZD-103',
    name: 'Second Floor, Medway House',
    address_line_1: 'Second Floor, Medway House',
    town: 'Rochester',
    postcode: 'ME1 1XL',
    disposal_type: 'to_let',
    status: 'under_offer',
    asking_rent_pence: pounds(41_250),
    size_min_sqft: 2_750,
    size_max_sqft: 2_750,
    use_class: 'E',
    sector: 'office',
    summary: 'Refurbished open-plan offices, EPC B, eight parking spaces.',
    brochure: false,
  },
  {
    ref: 'OZD-104',
    name: 'Former Dairy, Oast Lane',
    address_line_1: 'Former Dairy, Oast Lane',
    town: 'Paddock Wood',
    postcode: 'TN12 6XH',
    disposal_type: 'for_sale',
    status: 'marketing',
    asking_price_pence: pounds(1_150_000),
    size_min_sqft: 9_400,
    size_max_sqft: 9_400,
    use_class: 'B2',
    sector: 'industrial',
    summary: 'Freehold production building on 0.9 acres with yard.',
    brochure: false,
  },
  {
    ref: 'OZD-105',
    name: 'Units 2–3, Greensand Court',
    address_line_1: 'Units 2–3, Greensand Court',
    town: 'Sevenoaks',
    postcode: 'TN13 2XT',
    disposal_type: 'to_let',
    status: 'instructed',
    asking_rent_pence: pounds(22_800),
    size_min_sqft: 1_900,
    size_max_sqft: 3_800,
    use_class: 'E',
    sector: 'office',
    summary: 'Two self-contained office suites, available together or apart.',
    brochure: false,
  },
  {
    ref: 'OZD-106',
    name: 'Yard at Crowborough Road',
    address_line_1: 'Yard at Crowborough Road',
    town: 'Uckfield',
    postcode: 'TN22 1XP',
    disposal_type: 'to_let',
    status: 'let',
    asking_rent_pence: pounds(18_000),
    size_min_sqft: 21_780,
    size_max_sqft: 21_780,
    use_class: 'Sui generis',
    sector: 'land',
    summary: 'Secure hardstanding yard, 0.5 acres, palisade fencing.',
    brochure: false,
  },
] as const;

const REQUIREMENTS = [
  {
    key: 'ozer-demo-r1',
    company_name: 'Cobtree Logistics',
    contact_name: 'Priya Natarajan',
    location_text: 'Maidstone, M20 corridor',
    size_min_sqft: 4_000,
    size_max_sqft: 6_000,
    budget_max_pence: pounds(45_000),
    sector: 'industrial',
    use_class: 'B8',
    tenure: 'leasehold',
  },
  {
    key: 'ozer-demo-r2',
    company_name: 'Fenwright Dental Group',
    contact_name: 'Tom Ashdown',
    location_text: 'Tunbridge Wells town centre',
    size_min_sqft: 1_000,
    size_max_sqft: 1_500,
    budget_max_pence: pounds(30_000),
    sector: 'retail',
    use_class: 'E',
    tenure: 'leasehold',
  },
  {
    key: 'ozer-demo-r3',
    company_name: 'Orchard Row Architects',
    contact_name: 'Hannah Blake',
    location_text: 'Sevenoaks or Tonbridge',
    size_min_sqft: 1_800,
    size_max_sqft: 2_500,
    budget_max_pence: pounds(28_000),
    sector: 'office',
    use_class: 'E',
    tenure: 'leasehold',
  },
  {
    key: 'ozer-demo-r4',
    company_name: 'Weald Precision Engineering',
    contact_name: 'Marcus Oyelaran',
    location_text: 'Paddock Wood, Tonbridge',
    size_min_sqft: 8_000,
    size_max_sqft: 12_000,
    budget_max_pence: pounds(1_300_000),
    sector: 'industrial',
    use_class: 'B2',
    tenure: 'freehold',
  },
  {
    key: 'ozer-demo-r5',
    company_name: 'Brenchley Plant Hire',
    contact_name: 'Sam Kettle',
    location_text: 'East Sussex, A22',
    size_min_sqft: 15_000,
    size_max_sqft: 30_000,
    budget_max_pence: pounds(24_000),
    sector: 'land',
    use_class: 'Sui generis',
    tenure: 'leasehold',
  },
] as const;

const DEALS = [
  {
    ref: 'OZD-101',
    client: 'Harrow Lane Estates',
    stage: 'current',
    fee: 5_775,
  },
  {
    ref: 'OZD-102',
    client: 'Calverley Holdings',
    stage: 'current',
    fee: 4_050,
  },
  {
    ref: 'OZD-103',
    client: 'Medway House LLP',
    stage: 'under_offer',
    fee: 6_190,
  },
  {
    ref: 'OZD-104',
    client: 'Greensand Property Trust',
    stage: 'negotiating',
    fee: 17_250,
  },
  {
    ref: 'OZD-105',
    client: 'Greensand Property Trust',
    stage: 'potential',
    fee: 3_420,
  },
  {
    ref: 'OZD-106',
    client: 'Oast Farm Partnership',
    stage: 'completed',
    fee: 2_700,
  },
] as const;

async function main() {
  loadEnv();
  const { accountSlug, write } = parseArgs(process.argv.slice(2));

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SECRET_KEY');
  }
  assertLocal(url);

  const admin = createClient(url, key, { auth: { persistSession: false } });

  const { data: account, error: accountError } = await admin
    .from('accounts')
    .select('id, slug')
    .eq('slug', accountSlug)
    .maybeSingle();
  if (accountError) throw new Error(accountError.message);
  if (!account) throw new Error(`Account slug not found: ${accountSlug}`);

  console.log(
    `${write ? 'Seeding' : 'Dry run for'} ${LISTINGS.length} disposals, ${REQUIREMENTS.length} requirements, ${DEALS.length} WIP deals into ${accountSlug}`,
  );
  if (!write) return;

  await admin
    .from('pipeline_deals')
    .delete()
    .eq('account_id', account.id)
    .eq('source', DEMO_SOURCE);
  await admin
    .from('commercial_requirements')
    .delete()
    .eq('account_id', account.id)
    .like('external_key', 'ozer-demo-%');
  await admin
    .from('commercial_listings')
    .delete()
    .eq('account_id', account.id)
    .like('reference_number', `${DEMO_REF_PREFIX}%`);

  const brochureToken = crypto.randomUUID().replace(/-/g, '');
  const now = new Date().toISOString();

  const { data: listings, error: listingsError } = await admin
    .from('commercial_listings')
    .insert(
      LISTINGS.map(({ ref, brochure, ...listing }) => ({
        ...listing,
        account_id: account.id,
        reference_number: ref,
        is_instructed: true,
        on_market_at: listing.status === 'instructed' ? null : now,
        brochure_share_enabled: brochure,
        brochure_share_token: brochure ? brochureToken : null,
      })),
    )
    .select('id, reference_number');
  if (listingsError) throw new Error(listingsError.message);

  const listingIdByRef = new Map(
    (listings ?? []).map((row) => [row.reference_number, row.id]),
  );

  const { error: requirementsError } = await admin
    .from('commercial_requirements')
    .insert(
      REQUIREMENTS.map(({ key: externalKey, ...requirement }) => ({
        ...requirement,
        account_id: account.id,
        external_key: externalKey,
        source: DEMO_SOURCE,
      })),
    );
  if (requirementsError) throw new Error(requirementsError.message);

  const { error: dealsError } = await admin.from('pipeline_deals').insert(
    DEALS.map((deal, index) => ({
      account_id: account.id,
      name: deal.client,
      company_name: deal.client,
      stage: deal.stage,
      value: deal.fee,
      work_type: 'agency',
      source: DEMO_SOURCE,
      board_position: index,
      commercial_listing_id: listingIdByRef.get(deal.ref) ?? null,
    })),
  );
  if (dealsError) throw new Error(dealsError.message);

  console.log('Done. Capture with:');
  console.log(
    `  OZER_CAPTURE_ACCOUNT=${accountSlug} OZER_CAPTURE_LISTING_ID=${listingIdByRef.get('OZD-101')} OZER_CAPTURE_BROCHURE_TOKEN=${brochureToken} \\`,
  );
  console.log(
    '  OZER_CAPTURE_EMAIL=<you> OZER_CAPTURE_PASSWORD=<pw> pnpm --filter web exec tsx ../e2e/scripts/capture-marketing-screens.ts',
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
