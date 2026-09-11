# Stripe setup for Ozer (subscriptions + Connect)

Ozer already integrates Stripe in code. This guide wires a **new** Stripe account for:

1. **Platform subscriptions** — Community, Business, Property workspaces and add-ons
2. **Stripe Connect** — business owners connect Stripe so clients can pay invoices via Checkout

Production app host: `https://app.ozer.so`

---

## 1. Stripe Dashboard basics

1. Complete **business profile** and identity verification (required before live mode).
2. Set default currency to **GBP** (Settings → Business → Customer currency).
3. Copy API keys (Developers → API keys):
   - **Publishable key** → `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
   - **Secret key** → `STRIPE_SECRET_KEY` (prefer a [restricted key](https://docs.stripe.com/keys#limit-access) in production)

Start in **test mode**; repeat webhook + Connect steps for live when ready.

---

## 2. Create subscription products & prices

From `apps/web`:

```bash
STRIPE_SECRET_KEY=sk_test_... pnpm stripe:setup-catalog
```

Optional: write output to `.env.stripe-catalog`:

```bash
STRIPE_SECRET_KEY=sk_test_... pnpm stripe:setup-catalog -- --write-env
```

Paste the printed `STRIPE_PRICE_*` values into Vercel (Production + Preview) and local `.env.local`.

### Card-on-file trials (default)

Starter and Pro Checkout sessions set `payment_method_collection: always` so a card is collected up front for the 14-day trial. Do **not** set `STRIPE_ENABLE_TRIAL_WITHOUT_CC` in production unless you intentionally want a no-card trial that **cancels** at trial end if no payment method exists.

```bash
# Optional / not recommended for Ozer Business Starter & Pro
STRIPE_ENABLE_TRIAL_WITHOUT_CC=true
```

### Commercial Property (graduated seats)

The catalog script includes **Ozer Commercial Property** with a tiered monthly price:

- Seat 1 → £89
- Seats 2–7 → £55 each  
- Seats 8+ → £39 each

Env key: `STRIPE_PRICE_COMMERCIAL_PROPERTY_MONTHLY` (lookup key `keel.commercial_property.monthly`).

Checkout shows a promo-code field (`enableDiscountField`). For partner deals (e.g. Bracketts), create Stripe **Coupons** + **Promotion codes** in the Dashboard / API — Stripe does not chain “50% for 6 months then 15% forever” in one code; use an intro promo, then apply the lifetime promo when the intro ends.

### Campaigns add-on (GBP)

The catalog script includes **Ozer Campaigns** plus send packs and contact-cap bumps. Amounts match `apps/web/lib/billing/campaign-pricing.ts` and env keys in `stripe-price-ids.ts` / `billing.config.ts`.

**Subscription tiers** (`ozer-addon-campaigns`):

| Plan | Amount | Env key | Lookup key |
|------|--------|---------|------------|
| Starter | £9 / mo · 500 contacts · 5,000 sends | `STRIPE_PRICE_ADDON_CAMPAIGNS_STARTER_MONTHLY` | `keel.addon.campaigns.starter.monthly` |
| Growth | £19 / mo · 2,500 · 20,000 | `STRIPE_PRICE_ADDON_CAMPAIGNS_GROWTH_MONTHLY` | `keel.addon.campaigns.growth.monthly` |
| Pro | £49 / mo · 10,000 · 60,000 | `STRIPE_PRICE_ADDON_CAMPAIGNS_PRO_MONTHLY` | `keel.addon.campaigns.pro.monthly` |

**Send packs** (one-off lasts 12 months; monthly replenishes each cycle):

| Pack | One-off | Monthly | Env keys |
|------|---------|---------|----------|
| +2,000 sends | £6 (`STRIPE_PRICE_CAMPAIGNS_PACK_SEND_2K`) | £5 (`…_2K_MONTHLY`) | lookup `keel.campaigns.pack.send_2k` / `.monthly` |
| +10,000 sends | £24 (`…_SEND_10K`) | £20 (`…_10K_MONTHLY`) | `keel.campaigns.pack.send_10k` / `.monthly` |
| +50,000 sends | £99 (`…_SEND_50K`) | £99 (`…_50K_MONTHLY`) | `keel.campaigns.pack.send_50k` / `.monthly` |

**Contact bumps** (monthly only; no send units):

| Bump | Amount | Env key | Lookup key |
|------|--------|---------|------------|
| +500 contacts | £8 / mo | `STRIPE_PRICE_CAMPAIGNS_BUMP_CONTACTS_500_MONTHLY` | `keel.campaigns.bump.contacts_500.monthly` |
| +2,500 contacts | £29 / mo | `STRIPE_PRICE_CAMPAIGNS_BUMP_CONTACTS_2500_MONTHLY` | `keel.campaigns.bump.contacts_2500.monthly` |

Test and live Stripe are separate catalogs. Run `stripe:setup-catalog` with `sk_test_...` for Preview / local, then again with `sk_live_...` for Production. Paste each mode’s printed `price_…` IDs into the matching Vercel environment — do not reuse test IDs in live.

---

## 3. Enable Stripe Connect (invoice payments)

1. [Stripe Dashboard → Connect](https://dashboard.stripe.com/connect) → **Get started**.
2. Choose **Platform** (Ozer onboard businesses; payments go to their connected accounts).
3. Under **Connect settings → OAuth**:
   - **Redirect URI:** `https://app.ozer.so/api/stripe-connect/callback`
   - For local dev add: `http://localhost:3000/api/stripe-connect/callback`
4. Copy **Client ID** (`ca_...`) → `STRIPE_CONNECT_CLIENT_ID`

### How invoice payments work in Ozer

- Workspace owner/admin opens **Settings → Payments** and clicks **Connect Stripe**.
- OAuth stores `stripe_account_id` on the workspace.
- Client pays via invoice portal Checkout; funds transfer to the connected account (`transfer_data.destination`).
- Ozer does not take an application fee on invoices today (100% to the business).

---

## 4. Webhooks (three endpoints)

Create **three** webhook endpoints in [Developers → Webhooks](https://dashboard.stripe.com/webhooks). Use **test** and **live** separately.

### A. Platform billing — `/api/billing/webhook`

| Field | Value |
|-------|--------|
| URL | `https://app.ozer.so/api/billing/webhook` |
| Secret env | `STRIPE_WEBHOOK_SECRET` |

**Events:**

- `checkout.session.completed`
- `checkout.session.async_payment_succeeded`
- `checkout.session.async_payment_failed`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `invoice.paid`

### B. Invoice card payments — `/api/invoices/stripe-webhook`

| Field | Value |
|-------|--------|
| URL | `https://app.ozer.so/api/invoices/stripe-webhook` |
| Secret env | `STRIPE_INVOICE_WEBHOOK_SECRET` (or reuse `STRIPE_WEBHOOK_SECRET` if you prefer one secret per endpoint) |

**Events:**

- `checkout.session.completed`

### C. Connect (client subscriptions + account sync) — `/api/stripe-connect/webhook`

| Field | Value |
|-------|--------|
| URL | `https://app.ozer.so/api/stripe-connect/webhook` |
| Secret env | `STRIPE_CONNECT_WEBHOOK_SECRET` |
| Listen to | **Events on Connected accounts** (toggle on when creating endpoint) |

**Events:**

- `checkout.session.completed`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `invoice.paid`
- `invoice.payment_failed`
- `account.updated`

### Local development (Stripe CLI)

```bash
stripe listen --forward-to localhost:3000/api/billing/webhook
stripe listen --forward-to localhost:3000/api/invoices/stripe-webhook
stripe listen --forward-to localhost:3000/api/stripe-connect/webhook
```

Use separate terminal tabs; each prints a `whsec_...` signing secret.

---

## 5. Vercel environment variables

Set on **ozer-web** (Production; mirror to Preview for staging):

```bash
# Provider
NEXT_PUBLIC_BILLING_PROVIDER=stripe
NEXT_PUBLIC_ENABLE_TEAM_ACCOUNTS_BILLING=true

# Keys
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_SECRET_KEY=sk_live_...
STRIPE_BILLING_CURRENCY=GBP

# Webhooks
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_INVOICE_WEBHOOK_SECRET=whsec_...   # optional if different from billing
STRIPE_CONNECT_WEBHOOK_SECRET=whsec_...

# Connect OAuth
STRIPE_CONNECT_CLIENT_ID=ca_...

# OAuth state signing (random 32+ char secret; not the Stripe key)
OAUTH_STATE_SECRET=...

# All STRIPE_PRICE_* from stripe:setup-catalog output
STRIPE_PRICE_COMMUNITY_MONTHLY=price_...
# ... etc

# Campaigns (from the same script output — test IDs for Preview, live IDs for Production)
STRIPE_PRICE_ADDON_CAMPAIGNS_STARTER_MONTHLY=price_...
STRIPE_PRICE_ADDON_CAMPAIGNS_GROWTH_MONTHLY=price_...
STRIPE_PRICE_ADDON_CAMPAIGNS_PRO_MONTHLY=price_...
STRIPE_PRICE_CAMPAIGNS_PACK_SEND_2K=price_...
STRIPE_PRICE_CAMPAIGNS_PACK_SEND_2K_MONTHLY=price_...
STRIPE_PRICE_CAMPAIGNS_PACK_SEND_10K=price_...
STRIPE_PRICE_CAMPAIGNS_PACK_SEND_10K_MONTHLY=price_...
STRIPE_PRICE_CAMPAIGNS_PACK_SEND_50K=price_...
STRIPE_PRICE_CAMPAIGNS_PACK_SEND_50K_MONTHLY=price_...
STRIPE_PRICE_CAMPAIGNS_BUMP_CONTACTS_500_MONTHLY=price_...
STRIPE_PRICE_CAMPAIGNS_BUMP_CONTACTS_2500_MONTHLY=price_...
```

Redeploy after changing env vars.

---

## 6. Verify

### Subscriptions

1. Sign in → create or open a paid workspace (e.g. Community).
2. Go to workspace **Billing** → start checkout.
3. Complete test payment (`4242 4242 4242 4242`).
4. Confirm webhook delivery in Stripe Dashboard (200 from `/api/billing/webhook`).
5. Workspace should unlock (no billing redirect).

### Connect + invoices

1. Open a business workspace → **Settings → Payments**.
2. **Connect Stripe** → complete Connect onboarding (test mode).
3. Create and **send** an invoice to a client.
4. Open portal link → **Pay now**.
5. Confirm `checkout.session.completed` on `/api/invoices/stripe-webhook` and invoice status **paid**.

---

## 7. Go live checklist

- [ ] Switch Stripe Dashboard to **live** mode
- [ ] Run `stripe:setup-catalog` with `sk_live_...` (or duplicate products manually)
- [ ] Create live webhook endpoints + Connect OAuth redirect
- [ ] Update all Vercel env vars with live keys and price IDs
- [ ] Complete Stripe account activation (identity, bank details)
- [ ] Test one real small subscription and one Connect invoice in live mode
