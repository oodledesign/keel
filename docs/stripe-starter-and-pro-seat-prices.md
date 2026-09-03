# Stripe Product / Price definitions (manual creation)

This environment has **no Stripe API keys**. Create these objects in the
**Stripe Dashboard (test mode first)**, then set the matching env vars.

Do **not** point production env vars at these until Step 0 confirms zero
active/trialing Pro subscribers (see verification SQL below).

## Verification SQL (Step 0 — run on Project 1 before switching Pro Prices)

```sql
-- Count active/trialing subscriptions whose items use the current Pro prices.
-- Replace the placeholder price ids with the live STRIPE_PRICE_BUSINESS_* values.
select count(distinct s.id) as active_or_trialing_pro_subs
from public.subscriptions s
join public.subscription_items si on si.subscription_id = s.id
where s.status in ('active', 'trialing')
  and si.variant_id in (
    'price_ozer_business_monthly',  -- or live STRIPE_PRICE_BUSINESS_MONTHLY
    'price_ozer_business_yearly'    -- or live STRIPE_PRICE_BUSINESS_YEARLY
  );
```

If the count is **not** 0, do not archive/replace Pro Prices.

---

## 1. Starter (create now)

### Product
- Name: `Ozer Starter`
- Description: Clients, projects, invoices for freelancers — £14 first seat, £9 each additional

### Price (monthly, recurring)
- Lookup key / env: `STRIPE_PRICE_BUSINESS_STARTER_MONTHLY`
- Fallback id used in code until env is set: `price_ozer_business_starter_monthly`
- Currency: `gbp`
- Billing scheme: `tiered`
- Tiers mode: `graduated`
- Usage type: `licensed`
- Interval: `month`
- Tiers:
  - First 1 unit: £14.00 (`unit_amount` 1400)
  - Remaining (inf): £9.00 (`unit_amount` 900)

Wire: set `STRIPE_PRICE_BUSINESS_STARTER_MONTHLY=price_1UBhoRBKQFpwsVSaBDAkwrR9`
(live Price created 2026-09-03; product `prod_VC60ICBDZ5klpM`).

**Why one graduated Price (not flat + per_seat):** MakerKit checkout sets
`per_seat` quantity to **total** billable seats. A flat £14 + per_seat £9×N
line-item pair would charge £14 + £9 for a solo seat. Graduated tiers with
quantity=N match existing seat-update plumbing.

---

## 2. Pro corrected Prices (create only after Step 0 = 0)

Leave existing graduated Prices (`…business_monthly` / `…business_yearly`)
**active but unused** (do not delete) for historical invoices.

### Price monthly v2
- Env: `STRIPE_PRICE_BUSINESS_MONTHLY_V2`
- Fallback placeholder: `price_ozer_business_monthly_v2`
- Currency: `gbp`, tiered graduated, licensed, month
- Tiers:
  - First 1 unit: £29.00 (2900)
  - Remaining (inf): £22.00 (2200)
- **No third band** (£16 removed)

### Price yearly v2
- Env: `STRIPE_PRICE_BUSINESS_YEARLY_V2`
- Fallback placeholder: `price_ozer_business_yearly_v2`
- Same bands × 10: £290 / £220

### After creation + Step 0 = 0
1. Point `STRIPE_PRICE_BUSINESS_MONTHLY` / `YEARLY` at the new Price IDs **or**
   switch `billing.config.ts` line item ids to `business_monthly_v2` /
   `business_yearly_v2` and update `BUSINESS_GRADUATED_TIERS` to two bands.
2. Archive (deactivate) the old three-band Prices in Stripe — do not delete.

**Pro base seat (£29) amount is unchanged**; only the additional-seat schedule
changes (flat £22 forever instead of £22 then £16).
