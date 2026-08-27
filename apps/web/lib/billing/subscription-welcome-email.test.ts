import { beforeAll, describe, expect, it, vi } from 'vitest';

import type { UpsertSubscriptionParams } from '@kit/billing/types';

import { OZER_STRIPE_PRICES } from '~/lib/billing/stripe-price-ids';

const businessSubscription: UpsertSubscriptionParams = {
  target_account_id: 'account-1',
  target_customer_id: 'cus_123',
  target_subscription_id: 'sub_123',
  billing_provider: 'stripe',
  status: 'trialing',
  trial_ends_at: Math.floor(Date.now() / 1000) + 14 * 24 * 60 * 60,
  line_items: [
    {
      id: 'li_1',
      product_id: 'ozer-business',
      variant_id: OZER_STRIPE_PRICES.business_monthly,
      price_amount: 2900,
      quantity: 1,
    },
  ],
};

describe('subscription welcome email', () => {
  let resolveSubscriptionWelcomeContext: typeof import('./subscription-welcome-email').resolveSubscriptionWelcomeContext;
  let buildSubscriptionWelcomeEmail: typeof import('./subscription-welcome-email').buildSubscriptionWelcomeEmail;
  let resolveWelcomeEmailRecipients: typeof import('./billing-lifecycle-emails').resolveWelcomeEmailRecipients;

  beforeAll(async () => {
    vi.stubEnv('NEXT_PUBLIC_BILLING_PROVIDER', 'stripe');
    const mod = await import('./subscription-welcome-email');
    resolveSubscriptionWelcomeContext = mod.resolveSubscriptionWelcomeContext;
    buildSubscriptionWelcomeEmail = mod.buildSubscriptionWelcomeEmail;
    const lifecycle = await import('./billing-lifecycle-emails');
    resolveWelcomeEmailRecipients = lifecycle.resolveWelcomeEmailRecipients;
  });

  it('sends welcome email to payer and owner when different', () => {
    expect(
      resolveWelcomeEmailRecipients({
        ownerEmail: 'owner@example.com',
        payerEmail: 'payer@example.com',
      }),
    ).toEqual(['payer@example.com', 'owner@example.com']);
  });

  it('dedupes payer and owner when same inbox', () => {
    expect(
      resolveWelcomeEmailRecipients({
        ownerEmail: 'Owner@Example.com',
        payerEmail: 'owner@example.com',
      }),
    ).toEqual(['owner@example.com']);
  });

  it('returns plan details for a workspace subscription', () => {
    const context = resolveSubscriptionWelcomeContext(businessSubscription, {
      accountSlug: 'oodle',
      siteUrl: 'https://www.ozer.so',
    });

    expect(context).not.toBeNull();
    expect(context?.productName).toBe('Business');
    expect(context?.isTrial).toBe(true);
    expect(context?.features.length).toBeGreaterThan(0);
    expect(context?.gettingStartedSteps.length).toBeGreaterThan(0);
  });

  it('returns null for add-on-only subscriptions', () => {
    const addonOnly: UpsertSubscriptionParams = {
      ...businessSubscription,
      line_items: [
        {
          id: 'li_addon',
          product_id: 'ozer-addon-email-assistant',
          variant_id: OZER_STRIPE_PRICES.addon_email_assistant_monthly,
          price_amount: 900,
          quantity: 1,
        },
      ],
    };

    expect(
      resolveSubscriptionWelcomeContext(addonOnly, {
        accountSlug: 'oodle',
        siteUrl: 'https://www.ozer.so',
      }),
    ).toBeNull();
  });

  it('builds a trial welcome subject and body', () => {
    const welcome = resolveSubscriptionWelcomeContext(businessSubscription, {
      accountSlug: 'oodle',
      siteUrl: 'https://www.ozer.so',
    });

    expect(welcome).not.toBeNull();

    const email = buildSubscriptionWelcomeEmail({
      productName: 'Ozer',
      accountName: 'Oodle Design',
      workspaceUrl: 'https://www.ozer.so/app/oodle',
      welcome: welcome!,
      trialEndsAt: new Date().toISOString(),
    });

    expect(email.subject).toContain('Oodle Design');
    expect(email.subject).toContain('trial');
    expect(email.html).toContain('Business');
    expect(email.html).toContain('Add your first client');
  });

  it('builds a paid welcome subject when not trialing', () => {
    const welcome = resolveSubscriptionWelcomeContext(
      { ...businessSubscription, status: 'active' },
      {
        accountSlug: 'oodle',
        siteUrl: 'https://www.ozer.so',
      },
    );

    expect(welcome?.isTrial).toBe(false);

    const email = buildSubscriptionWelcomeEmail({
      productName: 'Ozer',
      accountName: 'Oodle Design',
      workspaceUrl: 'https://www.ozer.so/app/oodle',
      welcome: welcome!,
    });

    expect(email.subject).toContain('Welcome to Business');
    expect(email.html).toContain('Payment is confirmed');
  });
});
