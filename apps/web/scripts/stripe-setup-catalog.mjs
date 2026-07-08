#!/usr/bin/env node
/**
 * Bootstrap Ozer subscription products & prices in a Stripe account (test or live).
 *
 * Usage:
 *   STRIPE_SECRET_KEY=sk_test_... node scripts/stripe-setup-catalog.mjs
 *   STRIPE_SECRET_KEY=sk_test_... node scripts/stripe-setup-catalog.mjs --write-env
 *
 * Idempotent: re-run safely; matches products by metadata.ozer_catalog_id
 * (and legacy metadata.keel_catalog_id) and prices by lookup_key.
 * Price lookup_keys remain keel.* so existing live Stripe prices are reused.
 */

import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import Stripe from 'stripe';

const currency = (process.env.STRIPE_BILLING_CURRENCY ?? 'GBP').toLowerCase();
const writeEnv = process.argv.includes('--write-env');

const secret = process.env.STRIPE_SECRET_KEY?.trim();
if (!secret?.startsWith('sk_')) {
  console.error(
    'Set STRIPE_SECRET_KEY (sk_test_... or sk_live_...) before running this script.',
  );
  process.exit(1);
}

const stripe = new Stripe(secret);

/** @type {Array<{ catalogId: string; productName: string; prices: Array<{ envKey: string; lookupKey: string; amount: number; interval: 'month' | 'year' }> }>} */
const CATALOG = [
  {
    catalogId: 'ozer-community',
    productName: 'Ozer Community',
    prices: [
      {
        envKey: 'STRIPE_PRICE_COMMUNITY_MONTHLY',
        lookupKey: 'keel.community.monthly',
        amount: 1200,
        interval: 'month',
      },
      {
        envKey: 'STRIPE_PRICE_COMMUNITY_YEARLY',
        lookupKey: 'keel.community.yearly',
        amount: 12000,
        interval: 'year',
      },
    ],
  },
  {
    catalogId: 'ozer-business-lite',
    productName: 'Ozer Business Lite',
    prices: [
      {
        envKey: 'STRIPE_PRICE_BUSINESS_LITE_MONTHLY',
        lookupKey: 'keel.business_lite.monthly',
        amount: 0,
        interval: 'month',
      },
    ],
  },
  {
    catalogId: 'ozer-business-solo',
    productName: 'Ozer Business Solo',
    prices: [
      {
        envKey: 'STRIPE_PRICE_BUSINESS_SOLO_MONTHLY',
        lookupKey: 'keel.business_solo.monthly',
        amount: 2900,
        interval: 'month',
      },
      {
        envKey: 'STRIPE_PRICE_BUSINESS_SOLO_YEARLY',
        lookupKey: 'keel.business_solo.yearly',
        amount: 29000,
        interval: 'year',
      },
    ],
  },
  {
    catalogId: 'ozer-business-team',
    productName: 'Ozer Business Team',
    prices: [
      {
        envKey: 'STRIPE_PRICE_BUSINESS_TEAM_MONTHLY',
        lookupKey: 'keel.business_team.monthly',
        amount: 7900,
        interval: 'month',
      },
      {
        envKey: 'STRIPE_PRICE_BUSINESS_TEAM_YEARLY',
        lookupKey: 'keel.business_team.yearly',
        amount: 79000,
        interval: 'year',
      },
    ],
  },
  {
    catalogId: 'ozer-business-scale',
    productName: 'Ozer Business Scale',
    prices: [
      {
        envKey: 'STRIPE_PRICE_BUSINESS_SCALE_MONTHLY',
        lookupKey: 'keel.business_scale.monthly',
        amount: 14900,
        interval: 'month',
      },
      {
        envKey: 'STRIPE_PRICE_BUSINESS_SCALE_YEARLY',
        lookupKey: 'keel.business_scale.yearly',
        amount: 149000,
        interval: 'year',
      },
    ],
  },
  {
    catalogId: 'ozer-property-starter',
    productName: 'Ozer Property Starter',
    prices: [
      {
        envKey: 'STRIPE_PRICE_PROPERTY_STARTER_MONTHLY',
        lookupKey: 'keel.property_starter.monthly',
        amount: 1900,
        interval: 'month',
      },
      {
        envKey: 'STRIPE_PRICE_PROPERTY_STARTER_YEARLY',
        lookupKey: 'keel.property_starter.yearly',
        amount: 19000,
        interval: 'year',
      },
    ],
  },
  {
    catalogId: 'ozer-property-portfolio',
    productName: 'Ozer Property Portfolio',
    prices: [
      {
        envKey: 'STRIPE_PRICE_PROPERTY_PORTFOLIO_MONTHLY',
        lookupKey: 'keel.property_portfolio.monthly',
        amount: 2900,
        interval: 'month',
      },
      {
        envKey: 'STRIPE_PRICE_PROPERTY_PORTFOLIO_YEARLY',
        lookupKey: 'keel.property_portfolio.yearly',
        amount: 29000,
        interval: 'year',
      },
    ],
  },
  {
    catalogId: 'ozer-addon-email-assistant',
    productName: 'Ozer Email Assistant',
    prices: [
      {
        envKey: 'STRIPE_PRICE_ADDON_EMAIL_ASSISTANT_MONTHLY',
        lookupKey: 'keel.addon.email_assistant.monthly',
        amount: 900,
        interval: 'month',
      },
    ],
  },
  {
    catalogId: 'ozer-addon-signatures',
    productName: 'Ozer Signatures',
    prices: [
      {
        envKey: 'STRIPE_PRICE_ADDON_SIGNATURES_STARTER_MONTHLY',
        lookupKey: 'keel.addon.signatures.starter.monthly',
        amount: 900,
        interval: 'month',
      },
      {
        envKey: 'STRIPE_PRICE_ADDON_SIGNATURES_STARTER_YEARLY',
        lookupKey: 'keel.addon.signatures.starter.yearly',
        amount: 9000,
        interval: 'year',
      },
      {
        envKey: 'STRIPE_PRICE_ADDON_SIGNATURES_TEAM_MONTHLY',
        lookupKey: 'keel.addon.signatures.team.monthly',
        amount: 1900,
        interval: 'month',
      },
      {
        envKey: 'STRIPE_PRICE_ADDON_SIGNATURES_TEAM_YEARLY',
        lookupKey: 'keel.addon.signatures.team.yearly',
        amount: 19000,
        interval: 'year',
      },
      {
        envKey: 'STRIPE_PRICE_ADDON_SIGNATURES_OFFICE_MONTHLY',
        lookupKey: 'keel.addon.signatures.office.monthly',
        amount: 3900,
        interval: 'month',
      },
      {
        envKey: 'STRIPE_PRICE_ADDON_SIGNATURES_OFFICE_YEARLY',
        lookupKey: 'keel.addon.signatures.office.yearly',
        amount: 39000,
        interval: 'year',
      },
    ],
  },
  {
    catalogId: 'ozer-addon-rankly',
    productName: 'Ozer Rankly',
    prices: [
      {
        envKey: 'STRIPE_PRICE_ADDON_RANKLY_MONTHLY',
        lookupKey: 'keel.addon.rankly.monthly',
        amount: 3600,
        interval: 'month',
      },
    ],
  },
  {
    catalogId: 'ozer-addon-feedflow',
    productName: 'Ozer Feedflow',
    prices: [
      {
        envKey: 'STRIPE_PRICE_ADDON_FEEDFLOW_MONTHLY',
        lookupKey: 'keel.addon.feedflow.monthly',
        amount: 900,
        interval: 'month',
      },
    ],
  },
  {
    catalogId: 'ozer-addon-videos-starter',
    productName: 'Ozer Videos Starter',
    prices: [
      {
        envKey: 'STRIPE_PRICE_ADDON_VIDEOS_STARTER_MONTHLY',
        lookupKey: 'keel.addon.videos_starter.monthly',
        amount: 500,
        interval: 'month',
      },
    ],
  },
  {
    catalogId: 'ozer-addon-videos-growth',
    productName: 'Ozer Videos Growth',
    prices: [
      {
        envKey: 'STRIPE_PRICE_ADDON_VIDEOS_GROWTH_MONTHLY',
        lookupKey: 'keel.addon.videos_growth.monthly',
        amount: 1200,
        interval: 'month',
      },
    ],
  },
  {
    catalogId: 'ozer-addon-videos-pro',
    productName: 'Ozer Videos Pro',
    prices: [
      {
        envKey: 'STRIPE_PRICE_ADDON_VIDEOS_PRO_MONTHLY',
        lookupKey: 'keel.addon.videos_pro.monthly',
        amount: 2900,
        interval: 'month',
      },
    ],
  },
  {
    catalogId: 'ozer-addon-videos-studio',
    productName: 'Ozer Videos Studio',
    prices: [
      {
        envKey: 'STRIPE_PRICE_ADDON_VIDEOS_STUDIO_MONTHLY',
        lookupKey: 'keel.addon.videos_studio.monthly',
        amount: 4700,
        interval: 'month',
      },
    ],
  },
];

function toLegacyCatalogId(catalogId) {
  return catalogId.startsWith('ozer-')
    ? `keel-${catalogId.slice('ozer-'.length)}`
    : catalogId;
}

async function findProductByCatalogId(catalogId) {
  const legacyId = toLegacyCatalogId(catalogId);
  const queries = [
    `metadata['ozer_catalog_id']:'${catalogId}'`,
    `metadata['keel_catalog_id']:'${catalogId}'`,
    `metadata['ozer_catalog_id']:'${legacyId}'`,
    `metadata['keel_catalog_id']:'${legacyId}'`,
  ];

  for (const query of [...new Set(queries)]) {
    const products = await stripe.products.search({ query, limit: 1 });
    if (products.data[0]) {
      return products.data[0];
    }
  }

  return null;
}

async function ensureProduct(catalogId, productName) {
  const legacyId = toLegacyCatalogId(catalogId);
  const existing = await findProductByCatalogId(catalogId);
  if (existing) {
    return stripe.products.update(existing.id, {
      name: productName,
      metadata: {
        ...existing.metadata,
        ozer_catalog_id: catalogId,
        keel_catalog_id: existing.metadata?.keel_catalog_id || legacyId,
      },
    });
  }

  return stripe.products.create({
    name: productName,
    metadata: {
      ozer_catalog_id: catalogId,
      keel_catalog_id: legacyId,
    },
  });
}

async function ensurePrice(productId, priceDef) {
  const listed = await stripe.prices.list({
    lookup_keys: [priceDef.lookupKey],
    limit: 1,
  });

  if (listed.data[0]) {
    return listed.data[0];
  }

  return stripe.prices.create({
    product: productId,
    currency,
    unit_amount: priceDef.amount,
    recurring: { interval: priceDef.interval },
    lookup_key: priceDef.lookupKey,
    transfer_lookup_key: true,
    metadata: { keel_env_key: priceDef.envKey },
  });
}

async function main() {
  const mode = secret.startsWith('sk_live_') ? 'live' : 'test';
  console.log(`Ozer Stripe catalog setup (${mode}, ${currency.toUpperCase()})\n`);

  const envLines = [
    '# Generated by scripts/stripe-setup-catalog.mjs',
    `STRIPE_BILLING_CURRENCY=${currency.toUpperCase()}`,
  ];

  for (const item of CATALOG) {
    const product = await ensureProduct(item.catalogId, item.productName);
    console.log(`✓ ${item.productName} (${product.id})`);

    for (const priceDef of item.prices) {
      const price = await ensurePrice(product.id, priceDef);
      const label =
        priceDef.interval === 'year'
          ? `${priceDef.envKey} (yearly)`
          : priceDef.envKey;
      console.log(`  → ${label}: ${price.id}`);
      envLines.push(`${priceDef.envKey}=${price.id}`);
    }
  }

  console.log('\n--- Paste into Vercel / .env.local ---\n');
  console.log(envLines.join('\n'));

  if (writeEnv) {
    const target = resolve(process.cwd(), '.env.stripe-catalog');
    writeFileSync(target, `${envLines.join('\n')}\n`, 'utf8');
    console.log(`\nWrote ${target}`);
  }

  console.log('\nNext: configure webhooks & Connect — see docs/stripe-setup.md');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
