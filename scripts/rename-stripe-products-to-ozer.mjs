#!/usr/bin/env node
/**
 * Rename live (or test) Stripe products Keel → Ozer and attach dual catalog metadata.
 *
 * Usage (requires a secret key with Products write permission — not a restricted key):
 *   STRIPE_SECRET_KEY=sk_live_... node scripts/rename-stripe-products-to-ozer.mjs
 */
import Stripe from 'stripe';

const secret = process.env.STRIPE_SECRET_KEY?.trim();
if (!secret?.startsWith('sk_')) {
  console.error(
    'Set STRIPE_SECRET_KEY to sk_live_... or sk_test_... (not rk_...).',
  );
  process.exit(1);
}

const stripe = new Stripe(secret);

async function main() {
  const products = await stripe.products.list({ limit: 100, active: true });
  console.log(`Found ${products.data.length} products\n`);

  for (const product of products.data) {
    const name = product.name ?? '';
    const newName = name.startsWith('Keel ')
      ? name.replace('Keel ', 'Ozer ')
      : name;

    const meta = product.metadata ?? {};
    const catalog = meta.keel_catalog_id || meta.ozer_catalog_id || '';
    let ozerId = '';
    let keelId = '';

    if (catalog.startsWith('keel-')) {
      keelId = catalog;
      ozerId = catalog.replace(/^keel-/, 'ozer-');
    } else if (catalog.startsWith('ozer-')) {
      ozerId = catalog;
      keelId = catalog.replace(/^ozer-/, 'keel-');
    }

    if (!ozerId && newName.startsWith('Ozer ')) {
      // leave metadata unchanged if we cannot map
    }

    const metadata = {
      ...meta,
      ...(ozerId ? { ozer_catalog_id: ozerId } : {}),
      ...(keelId ? { keel_catalog_id: keelId } : {}),
    };

    const updated = await stripe.products.update(product.id, {
      name: newName,
      metadata,
    });

    console.log(`✓ ${updated.name} (${updated.id})`);
    console.log(
      `  meta: ${JSON.stringify({
        ozer_catalog_id: updated.metadata?.ozer_catalog_id,
        keel_catalog_id: updated.metadata?.keel_catalog_id,
      })}`,
    );
  }

  console.log(
    '\nDone. Checkout still uses price IDs from Vercel STRIPE_PRICE_* env vars.',
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
