import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import Stripe from 'stripe';

import { requireUser } from '@kit/supabase/require-user';

import type {
  ClientSubscriptionRecord,
  PlanBillingInterval,
  PlanTemplateKind,
  PlanTemplateRecord,
  SubscriptionLineItemRecord,
} from '~/lib/billing/plan-templates-types';
import {
  getSiteOrigin,
  getStripeClientSecret,
} from '~/lib/billing/stripe-connect';

type Db = SupabaseClient;

function stripe() {
  return new Stripe(getStripeClientSecret());
}

function mapTemplate(row: Record<string, unknown>): PlanTemplateRecord {
  return {
    id: String(row.id),
    accountId: String(row.account_id),
    kind: (row.kind as PlanTemplateKind) ?? 'custom',
    name: String(row.name ?? ''),
    description: row.description ? String(row.description) : null,
    amount: Number(row.amount ?? 0),
    currency: String(row.currency ?? 'gbp').toLowerCase(),
    interval: (row.billing_interval as PlanBillingInterval) ?? 'month',
    stripeProductId: row.stripe_product_id
      ? String(row.stripe_product_id)
      : null,
    stripePriceId: row.stripe_price_id ? String(row.stripe_price_id) : null,
    active: Boolean(row.active ?? true),
    createdAt: String(row.created_at ?? ''),
    updatedAt: String(row.updated_at ?? ''),
  };
}

function mapSubscription(
  row: Record<string, unknown>,
): ClientSubscriptionRecord {
  return {
    id: String(row.id),
    accountId: String(row.account_id ?? ''),
    businessId: row.business_id ? String(row.business_id) : null,
    clientId: row.client_id ? String(row.client_id) : null,
    clientOrgId: row.client_org_id ? String(row.client_org_id) : null,
    websiteId: row.website_id ? String(row.website_id) : null,
    planTemplateId: row.plan_template_id ? String(row.plan_template_id) : null,
    planName: row.plan_name ? String(row.plan_name) : null,
    subscriptionKind: (row.subscription_kind as PlanTemplateKind) ?? null,
    monthlyAmount: Number(row.monthly_amount ?? 0),
    currency: String(row.currency ?? 'gbp').toLowerCase(),
    status: (row.status as ClientSubscriptionRecord['status']) ?? 'pending',
    stripeSubscriptionId: row.stripe_subscription_id
      ? String(row.stripe_subscription_id)
      : null,
    stripeCustomerId:
      (row.stripe_customer_id_connect
        ? String(row.stripe_customer_id_connect)
        : null) ??
      (row.stripe_customer_id ? String(row.stripe_customer_id) : null),
    stripePriceId: row.stripe_price_id ? String(row.stripe_price_id) : null,
    stripePaymentLink: row.stripe_payment_link
      ? String(row.stripe_payment_link)
      : null,
    stripeCheckoutSessionId: row.stripe_checkout_session_id
      ? String(row.stripe_checkout_session_id)
      : null,
    currentPeriodEnd: row.current_period_end
      ? String(row.current_period_end)
      : null,
    nextBillingDate: row.next_billing_date
      ? String(row.next_billing_date)
      : null,
    createdAt: String(row.created_at ?? ''),
    updatedAt: String(row.updated_at ?? ''),
  };
}

export function createPlanTemplatesService(client: Db) {
  return new PlanTemplatesService(client);
}

class PlanTemplatesService {
  constructor(private readonly client: Db) {}

  // New G2 tables may not yet be in generated Database types.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private get db(): any {
    return this.client;
  }

  private async ensureMember(accountId: string) {
    const auth = await requireUser(this.client);
    if (!auth.data) throw new Error('Unauthorised');
    const { data: membership } = await this.db
      .from('accounts_memberships')
      .select('account_role')
      .eq('account_id', accountId)
      .eq('user_id', auth.data.id)
      .maybeSingle();
    const role = membership?.account_role as string | undefined;
    if (!role || role === 'client' || role === 'contractor') {
      throw new Error('Forbidden');
    }
    return { userId: auth.data.id, role };
  }

  async listTemplates(
    accountId: string,
    options?: { kind?: PlanTemplateKind; activeOnly?: boolean },
  ): Promise<PlanTemplateRecord[]> {
    await this.ensureMember(accountId);
    let query = this.db
      .from('plan_templates')
      .select('*')
      .eq('account_id', accountId)
      .order('name', { ascending: true });
    if (options?.kind) query = query.eq('kind', options.kind);
    if (options?.activeOnly) query = query.eq('active', true);
    const { data, error } = await query;
    if (error) throw error;
    return ((data ?? []) as Array<Record<string, unknown>>).map(mapTemplate);
  }

  async getTemplate(
    accountId: string,
    id: string,
  ): Promise<PlanTemplateRecord | null> {
    await this.ensureMember(accountId);
    const { data, error } = await this.db
      .from('plan_templates')
      .select('*')
      .eq('account_id', accountId)
      .eq('id', id)
      .maybeSingle();
    if (error) throw error;
    return data ? mapTemplate(data as Record<string, unknown>) : null;
  }

  async upsertTemplate(input: {
    accountId: string;
    id?: string;
    kind: PlanTemplateKind;
    name: string;
    description?: string | null;
    amount: number;
    currency: string;
    interval: PlanBillingInterval;
    active?: boolean;
  }): Promise<PlanTemplateRecord> {
    await this.ensureMember(input.accountId);

    if (input.id) {
      const existing = await this.getTemplate(input.accountId, input.id);
      if (!existing) throw new Error('Plan template not found');

      const amountChanged = existing.amount !== input.amount;
      const currencyChanged =
        existing.currency !== input.currency.toLowerCase();
      const intervalChanged = existing.interval !== input.interval;
      const needsNewPrice = amountChanged || currencyChanged || intervalChanged;

      const { data, error } = await this.db
        .from('plan_templates')
        .update({
          kind: input.kind,
          name: input.name,
          description: input.description ?? null,
          amount: input.amount,
          currency: input.currency.toLowerCase(),
          billing_interval: input.interval,
          active: input.active ?? true,
          // Clear price pointer when commercial terms change — lazy recreate on next use
          ...(needsNewPrice ? { stripe_price_id: null } : {}),
        })
        .eq('id', input.id)
        .eq('account_id', input.accountId)
        .select('*')
        .single();
      if (error) throw error;
      return mapTemplate(data as Record<string, unknown>);
    }

    const { data, error } = await this.db
      .from('plan_templates')
      .insert({
        account_id: input.accountId,
        kind: input.kind,
        name: input.name,
        description: input.description ?? null,
        amount: input.amount,
        currency: input.currency.toLowerCase(),
        billing_interval: input.interval,
        active: input.active ?? true,
      })
      .select('*')
      .single();
    if (error) throw error;
    return mapTemplate(data as Record<string, unknown>);
  }

  async deleteTemplate(accountId: string, id: string) {
    await this.ensureMember(accountId);
    const { error } = await this.db
      .from('plan_templates')
      .update({ active: false })
      .eq('id', id)
      .eq('account_id', accountId);
    if (error) throw error;
    return { ok: true as const };
  }

  async resolveConnectAccount(accountId: string): Promise<{
    stripeAccountId: string;
    applicationFeePercent: number;
  }> {
    const { data: settings } = await this.db
      .from('account_payment_settings')
      .select(
        'stripe_account_id, stripe_connect_enabled, application_fee_percent',
      )
      .eq('account_id', accountId)
      .maybeSingle();

    if (settings?.stripe_connect_enabled && settings.stripe_account_id) {
      const raw = Number(
        (settings as { application_fee_percent?: number })
          .application_fee_percent ?? 10,
      );
      const platformMin = Number(process.env.PLATFORM_MIN_FEE_PERCENT ?? '0');
      return {
        stripeAccountId: String(settings.stripe_account_id),
        applicationFeePercent: Math.min(
          100,
          Math.max(platformMin, Number.isFinite(raw) ? raw : 10),
        ),
      };
    }

    // Legacy agency_stripe via businesses
    const { data: business } = await this.db
      .from('businesses')
      .select('id')
      .eq('account_id', accountId)
      .maybeSingle();

    if (business?.id) {
      const { data: agency } = await this.db
        .from('agency_stripe')
        .select(
          'stripe_account_id, stripe_connect_enabled, application_fee_percent',
        )
        .eq('business_id', business.id)
        .maybeSingle();

      if (agency?.stripe_connect_enabled && agency.stripe_account_id) {
        return {
          stripeAccountId: String(agency.stripe_account_id),
          applicationFeePercent: Number(agency.application_fee_percent ?? 10),
        };
      }
    }

    throw new Error(
      'Connect Stripe under Settings → Payments before creating recurring plans',
    );
  }

  /**
   * Lazily create Product + Price on the connected account; store ids on template.
   * Amount edits clear stripe_price_id; callers recreate a new Price here.
   */
  async ensureStripePrice(
    accountId: string,
    templateId: string,
  ): Promise<PlanTemplateRecord> {
    await this.ensureMember(accountId);
    const template = await this.getTemplate(accountId, templateId);
    if (!template) throw new Error('Plan template not found');
    if (template.amount <= 0) {
      throw new Error('Plan amount must be greater than zero');
    }

    const { stripeAccountId } = await this.resolveConnectAccount(accountId);
    const s = stripe();

    let productId = template.stripeProductId;
    if (!productId) {
      const product = await s.products.create(
        {
          name: template.name,
          description: template.description ?? undefined,
          metadata: {
            ozer_account_id: accountId,
            plan_template_id: template.id,
            subscription_kind: template.kind,
          },
        },
        { stripeAccount: stripeAccountId },
      );
      productId = product.id;
    }

    let priceId = template.stripePriceId;
    if (!priceId) {
      const price = await s.prices.create(
        {
          product: productId,
          unit_amount: template.amount,
          currency: template.currency,
          recurring: { interval: template.interval },
          metadata: {
            ozer_account_id: accountId,
            plan_template_id: template.id,
            subscription_kind: template.kind,
          },
        },
        { stripeAccount: stripeAccountId },
      );
      priceId = price.id;
    }

    const { data, error } = await this.db
      .from('plan_templates')
      .update({
        stripe_product_id: productId,
        stripe_price_id: priceId,
      })
      .eq('id', template.id)
      .eq('account_id', accountId)
      .select('*')
      .single();
    if (error) throw error;
    return mapTemplate(data as Record<string, unknown>);
  }

  private async ensureConnectCustomer(input: {
    accountId: string;
    clientId: string;
    email: string;
    name: string;
    stripeAccountId: string;
  }): Promise<string> {
    const { data: clientRow } = await this.db
      .from('clients')
      .select('id, stripe_customer_id_connect, email, display_name')
      .eq('id', input.clientId)
      .eq('account_id', input.accountId)
      .maybeSingle();

    if (!clientRow) throw new Error('Client not found');

    const existing = (
      clientRow as { stripe_customer_id_connect?: string | null }
    ).stripe_customer_id_connect;
    if (existing) return existing;

    const customer = await stripe().customers.create(
      {
        email: input.email,
        name: input.name || undefined,
        metadata: {
          ozer_account_id: input.accountId,
          client_id: input.clientId,
        },
      },
      { stripeAccount: input.stripeAccountId },
    );

    const { error } = await this.db
      .from('clients')
      .update({ stripe_customer_id_connect: customer.id })
      .eq('id', input.clientId)
      .eq('account_id', input.accountId);
    if (error) throw error;

    return customer.id;
  }

  private async resolveBusinessId(accountId: string): Promise<string | null> {
    const { data } = await this.db
      .from('businesses')
      .select('id')
      .eq('account_id', accountId)
      .maybeSingle();
    return data?.id ? String(data.id) : accountId;
  }

  /**
   * Attach a plan → incomplete subscription + Checkout URL on the connected account.
   */
  async attachPlan(input: {
    accountId: string;
    planTemplateId: string;
    clientId: string;
    websiteId?: string | null;
  }): Promise<{
    subscription: ClientSubscriptionRecord;
    checkoutUrl: string;
    lineItem: SubscriptionLineItemRecord;
  }> {
    await this.ensureMember(input.accountId);

    const template = await this.ensureStripePrice(
      input.accountId,
      input.planTemplateId,
    );
    if (!template.stripePriceId) {
      throw new Error('Could not create Stripe price for this plan');
    }

    const { data: clientRow, error: clientError } = await this.db
      .from('clients')
      .select('id, email, display_name, client_org_id')
      .eq('id', input.clientId)
      .eq('account_id', input.accountId)
      .maybeSingle();
    if (clientError) throw clientError;
    if (!clientRow) throw new Error('Client not found');

    const email = String(
      (clientRow as { email?: string | null }).email ?? '',
    ).trim();
    if (!email) {
      throw new Error(
        'Client needs a billing email before starting a subscription',
      );
    }

    let clientOrgId =
      (clientRow as { client_org_id?: string | null }).client_org_id ?? null;

    if (input.websiteId) {
      const { data: website } = await this.db
        .from('websites')
        .select('id, client_org_id, business_id')
        .eq('id', input.websiteId)
        .eq('business_id', input.accountId)
        .maybeSingle();
      if (!website) throw new Error('Website not found');
      if (website.client_org_id) {
        clientOrgId = String(website.client_org_id);
      }
    }

    const connect = await this.resolveConnectAccount(input.accountId);
    const stripeCustomerId = await this.ensureConnectCustomer({
      accountId: input.accountId,
      clientId: input.clientId,
      email,
      name: String((clientRow as { display_name?: string }).display_name ?? ''),
      stripeAccountId: connect.stripeAccountId,
    });

    const businessId = await this.resolveBusinessId(input.accountId);

    const { data: subRow, error: subError } = await this.db
      .from('client_subscriptions')
      .insert({
        account_id: input.accountId,
        business_id: businessId,
        client_id: input.clientId,
        client_org_id: clientOrgId,
        website_id: input.websiteId ?? null,
        plan_template_id: template.id,
        plan_name: template.name,
        subscription_kind: template.kind,
        monthly_amount: template.amount,
        currency: template.currency,
        status: 'incomplete',
        stripe_price_id: template.stripePriceId,
        stripe_customer_id: stripeCustomerId,
        stripe_customer_id_connect: stripeCustomerId,
      })
      .select('*')
      .single();
    if (subError) throw subError;

    const subscription = mapSubscription(subRow as Record<string, unknown>);

    const { data: lineRow, error: lineError } = await this.db
      .from('subscription_line_items')
      .insert({
        client_subscription_id: subscription.id,
        account_id: input.accountId,
        plan_template_id: template.id,
        kind: template.kind,
        description: template.name,
        amount: template.amount,
        currency: template.currency,
        billing_interval: template.interval,
        stripe_price_id: template.stripePriceId,
        item_type: 'recurring_price',
        status: 'active',
      })
      .select('*')
      .single();
    if (lineError) throw lineError;

    const origin = getSiteOrigin();
    const successUrl = `${origin}/api/client-subscriptions/checkout?subscriptionId=${encodeURIComponent(subscription.id)}&completed=1&session_id={CHECKOUT_SESSION_ID}`;
    const cancelUrl = `${origin}/api/client-subscriptions/checkout?subscriptionId=${encodeURIComponent(subscription.id)}&cancelled=1`;

    const session = await stripe().checkout.sessions.create(
      {
        mode: 'subscription',
        customer: stripeCustomerId,
        line_items: [{ price: template.stripePriceId, quantity: 1 }],
        success_url: successUrl,
        cancel_url: cancelUrl,
        client_reference_id: subscription.id,
        metadata: {
          ozer_account_id: input.accountId,
          client_id: input.clientId,
          website_id: input.websiteId ?? '',
          subscription_kind: template.kind,
          client_subscription_id: subscription.id,
          plan_template_id: template.id,
        },
        subscription_data: {
          application_fee_percent: connect.applicationFeePercent,
          metadata: {
            ozer_account_id: input.accountId,
            client_id: input.clientId,
            website_id: input.websiteId ?? '',
            subscription_kind: template.kind,
            client_subscription_id: subscription.id,
            plan_template_id: template.id,
          },
        },
      },
      { stripeAccount: connect.stripeAccountId },
    );

    if (!session.url) {
      throw new Error('Stripe Checkout did not return a URL');
    }

    const { data: updated, error: updateError } = await this.db
      .from('client_subscriptions')
      .update({
        stripe_payment_link: session.url,
        stripe_checkout_session_id: session.id,
        status: 'incomplete',
      })
      .eq('id', subscription.id)
      .select('*')
      .single();
    if (updateError) throw updateError;

    const line = lineRow as Record<string, unknown>;

    return {
      subscription: mapSubscription(updated as Record<string, unknown>),
      checkoutUrl: session.url,
      lineItem: {
        id: String(line.id),
        clientSubscriptionId: subscription.id,
        accountId: input.accountId,
        planTemplateId: template.id,
        kind: template.kind,
        description: template.name,
        amount: template.amount,
        currency: template.currency,
        interval: template.interval,
        stripePriceId: template.stripePriceId,
      },
    };
  }

  async listSubscriptions(
    accountId: string,
    filters?: { clientId?: string; websiteId?: string },
  ): Promise<ClientSubscriptionRecord[]> {
    await this.ensureMember(accountId);
    let query = this.db
      .from('client_subscriptions')
      .select('*')
      .eq('account_id', accountId)
      .order('created_at', { ascending: false });
    if (filters?.clientId) query = query.eq('client_id', filters.clientId);
    if (filters?.websiteId) query = query.eq('website_id', filters.websiteId);
    const { data, error } = await query;
    if (error) throw error;
    return ((data ?? []) as Array<Record<string, unknown>>).map(
      mapSubscription,
    );
  }

  async cancelSubscription(accountId: string, subscriptionId: string) {
    await this.ensureMember(accountId);
    const { data: row } = await this.db
      .from('client_subscriptions')
      .select('*')
      .eq('id', subscriptionId)
      .eq('account_id', accountId)
      .maybeSingle();
    if (!row) throw new Error('Subscription not found');

    const sub = mapSubscription(row as Record<string, unknown>);
    if (sub.stripeSubscriptionId) {
      try {
        const connect = await this.resolveConnectAccount(accountId);
        await stripe().subscriptions.cancel(sub.stripeSubscriptionId, {
          stripeAccount: connect.stripeAccountId,
        });
      } catch {
        // Local cancel still marked; Stripe may already be cancelled
      }
    }

    const { data, error } = await this.db
      .from('client_subscriptions')
      .update({
        status: 'cancelled',
        cancelled_at: new Date().toISOString(),
      })
      .eq('id', subscriptionId)
      .eq('account_id', accountId)
      .select('*')
      .single();
    if (error) throw error;
    return mapSubscription(data as Record<string, unknown>);
  }

  /**
   * Resend / recreate a payment link for incomplete setup or overdue invoices.
   * No client emails — returns a URL for the agency to share.
   */
  async resendPaymentLink(
    accountId: string,
    subscriptionId: string,
  ): Promise<{
    url: string;
    kind: 'checkout' | 'hosted_invoice' | 'billing_portal';
  }> {
    await this.ensureMember(accountId);

    const { data: row } = await this.db
      .from('client_subscriptions')
      .select('*')
      .eq('id', subscriptionId)
      .eq('account_id', accountId)
      .maybeSingle();
    if (!row) throw new Error('Subscription not found');

    const sub = mapSubscription(row as Record<string, unknown>);
    const connect = await this.resolveConnectAccount(accountId);

    // Past-due: prefer open Stripe invoice hosted page, else Billing Portal.
    // Never create a second Checkout subscription for an existing Stripe sub.
    if (sub.status === 'overdue') {
      if (!sub.stripeSubscriptionId) {
        throw new Error(
          'Past-due subscription is missing Stripe ids — cancel and reattach',
        );
      }

      const invoices = await stripe().invoices.list(
        {
          subscription: sub.stripeSubscriptionId,
          status: 'open',
          limit: 1,
        },
        { stripeAccount: connect.stripeAccountId },
      );
      const hosted = invoices.data[0]?.hosted_invoice_url;
      if (hosted) {
        return { url: hosted, kind: 'hosted_invoice' };
      }

      if (!sub.stripeCustomerId) {
        throw new Error('No Stripe customer on this subscription');
      }

      const { createPortalBillingService } =
        await import('~/portal/[slug]/_lib/server/portal-billing.service');
      const configurationId = await createPortalBillingService(
        this.client,
      ).ensureBillingPortalConfiguration(accountId, connect.stripeAccountId);

      const origin = getSiteOrigin();
      const session = await stripe().billingPortal.sessions.create(
        {
          customer: sub.stripeCustomerId,
          return_url: origin,
          configuration: configurationId,
        },
        { stripeAccount: connect.stripeAccountId },
      );
      if (!session.url) throw new Error('Could not create billing portal link');
      return { url: session.url, kind: 'billing_portal' };
    }

    if (sub.status !== 'incomplete' && sub.status !== 'pending') {
      throw new Error(
        'Payment link is only available for pending or past-due plans',
      );
    }

    const priceId =
      sub.stripePriceId ??
      (
        await this.db
          .from('subscription_line_items')
          .select('stripe_price_id')
          .eq('client_subscription_id', subscriptionId)
          .eq('account_id', accountId)
          .limit(1)
          .maybeSingle()
      ).data?.stripe_price_id;

    if (!priceId) {
      throw new Error('Missing Stripe price — reattach the plan');
    }

    if (!sub.stripeCustomerId) {
      throw new Error('Missing Stripe customer — reattach the plan');
    }

    if (!sub.clientId) {
      throw new Error('Subscription is missing a client');
    }

    const origin = getSiteOrigin();
    const successUrl = `${origin}/api/client-subscriptions/checkout?subscriptionId=${encodeURIComponent(subscriptionId)}&completed=1&session_id={CHECKOUT_SESSION_ID}`;
    const cancelUrl = `${origin}/api/client-subscriptions/checkout?subscriptionId=${encodeURIComponent(subscriptionId)}&cancelled=1`;

    const session = await stripe().checkout.sessions.create(
      {
        mode: 'subscription',
        customer: sub.stripeCustomerId,
        line_items: [{ price: String(priceId), quantity: 1 }],
        success_url: successUrl,
        cancel_url: cancelUrl,
        client_reference_id: subscriptionId,
        metadata: {
          ozer_account_id: accountId,
          client_id: sub.clientId,
          website_id: sub.websiteId ?? '',
          subscription_kind: sub.subscriptionKind ?? '',
          client_subscription_id: subscriptionId,
          plan_template_id: sub.planTemplateId ?? '',
        },
        subscription_data: {
          application_fee_percent: connect.applicationFeePercent,
          metadata: {
            ozer_account_id: accountId,
            client_id: sub.clientId,
            website_id: sub.websiteId ?? '',
            subscription_kind: sub.subscriptionKind ?? '',
            client_subscription_id: subscriptionId,
            plan_template_id: sub.planTemplateId ?? '',
          },
        },
      },
      { stripeAccount: connect.stripeAccountId },
    );

    if (!session.url) {
      throw new Error('Stripe Checkout did not return a URL');
    }

    await this.db
      .from('client_subscriptions')
      .update({
        stripe_payment_link: session.url,
        stripe_checkout_session_id: session.id,
        status: 'incomplete',
      })
      .eq('id', subscriptionId)
      .eq('account_id', accountId);

    return { url: session.url, kind: 'checkout' };
  }

  /**
   * Reconcile connected-account Checkout completion → active + period end.
   */
  async reconcileCheckoutSession(
    subscriptionId: string,
    checkoutSessionId: string,
  ) {
    const { data: row } = await this.db
      .from('client_subscriptions')
      .select('*')
      .eq('id', subscriptionId)
      .maybeSingle();
    if (!row) throw new Error('Subscription not found');

    const sub = mapSubscription(row as Record<string, unknown>);
    if (!sub.accountId) throw new Error('Subscription missing account');

    const connect = await this.resolveConnectAccount(sub.accountId);
    const session = await stripe().checkout.sessions.retrieve(
      checkoutSessionId,
      { expand: ['subscription'] },
      { stripeAccount: connect.stripeAccountId },
    );

    if (session.metadata?.client_subscription_id !== subscriptionId) {
      throw new Error('Checkout session does not match subscription');
    }

    if (session.mode !== 'subscription' || session.payment_status !== 'paid') {
      return {
        activated: false as const,
        reason: 'payment_not_complete' as const,
      };
    }

    const stripeSubscription =
      typeof session.subscription === 'string'
        ? await stripe().subscriptions.retrieve(session.subscription, {
            stripeAccount: connect.stripeAccountId,
          })
        : session.subscription;

    if (!stripeSubscription) {
      return {
        activated: false as const,
        reason: 'missing_subscription' as const,
      };
    }

    const periodEndUnix = (
      stripeSubscription as {
        current_period_end?: number;
      }
    ).current_period_end;

    const periodEnd = periodEndUnix
      ? new Date(periodEndUnix * 1000).toISOString()
      : null;

    const { error } = await this.db
      .from('client_subscriptions')
      .update({
        stripe_subscription_id: stripeSubscription.id,
        stripe_customer_id:
          typeof session.customer === 'string'
            ? session.customer
            : (session.customer?.id ?? sub.stripeCustomerId),
        stripe_customer_id_connect:
          typeof session.customer === 'string'
            ? session.customer
            : (session.customer?.id ?? sub.stripeCustomerId),
        status: 'active',
        current_period_end: periodEnd,
        next_billing_date: periodEnd,
        started_at: new Date().toISOString(),
      })
      .eq('id', subscriptionId);

    if (error) {
      return { activated: false as const, reason: 'update_failed' as const };
    }

    return { activated: true as const, periodEnd };
  }
}
