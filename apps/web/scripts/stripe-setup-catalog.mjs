#!/usr/bin/env node
/**
 * Bootstrap Keel subscription products & prices in a Stripe account (test or live).
 *
 * Usage:
 *   STRIPE_SECRET_KEY=sk_test_... node scripts/stripe-setup-catalog.mjs
 *   STRIPE_SECRET_KEY=sk_test_... node scripts/stripe-setup-catalog.mjs --write-env
 *
 * Idempotent: re-run safely; matches products by metadata.keel_catalog_id and
 * prices by lookup_key.
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
    catalogId: 'keel-community',
    productName: 'Keel Community',
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
    catalogId: 'keel-business-lite',
    productName: 'Keel Business Lite',
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
    catalogId: 'keel-business-solo',
    productName: 'Keel Business Solo',
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
    catalogId: 'keel-business-team',
    productName: 'Keel Business Team',
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
    catalogId: 'keel-business-scale',
    productName: 'Keel Business Scale',
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
    catalogId: 'keel-property-starter',
    productName: 'Keel Property Starter',
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
    catalogId: 'keel-property-portfolio',
    productName: 'Keel Property Portfolio',
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
    catalogId: 'keel-addon-email-assistant',
    productName: 'Keel Email Assistant',
    prices: [
      {
        envKey: 'STRIPE_PRICE_ADDON_EMAIL_ASSISTANT_MONTHLY',
        lookupKey: 'keel.addon.email_assistant.monthly',
        amount: 900,
    productName: 'Keel Signatures',
    prices: [
      {
        envKey: 'STRIPE_PRICE_ADDON_SIGNATURES_MONTHLY',
        lookupKey: 'keel.addon.signatures.monthly',
        amount: 900,
        interval: 'month',
      },
    ],
  },
  {
    catalogId: 'keel-addon-rankly',
    productName: 'Keel Rankly',
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
    catalogId: 'keel-addon-feedflow',
    productName: 'Keel Feedflow',
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
    catalogId: 'keel-addon-videos-starter',
    productName: 'Keel Videos Starter',
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
    catalogId: 'keel-addon-videos-growth',
    productName: 'Keel Videos Growth',
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
    catalogId: 'keel-addon-videos-pro',
    productName: 'Keel Videos Pro',
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
    catalogId: 'keel-addon-videos-studio',
    productName: 'Keel Videos Studio',
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

async function findProductByCatalogId(catalogId) {
  const products = await stripe.products.search({
    query: `metadata['keel_catalog_id']:'${catalogId}'`,
    limit: 1,
  });
  return products.data[0] ?? null;
}

async function ensureProduct(catalogId, productName) {
  const existing = await findProductByCatalogId(catalogId);
  if (existing) {
    return existing;
  }

  return stripe.products.create({
    name: productName,
    metadata: { keel_catalog_id: catalogId },
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
  console.log(`Keel Stripe catalog setup (${mode}, ${currency.toUpperCase()})\n`);

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
