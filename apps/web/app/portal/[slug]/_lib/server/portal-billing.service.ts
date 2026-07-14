import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import Stripe from 'stripe';

import { requireUser } from '@kit/supabase/require-user';
import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

import type { PlanBillingInterval } from '~/lib/billing/plan-templates-types';
import {
  getSiteOrigin,
  getStripeClientSecret,
} from '~/lib/billing/stripe-connect';

const INVOICE_CACHE_TTL_MS = 15 * 60 * 1000;

export type PortalBillingSubscription = {
  id: string;
  planName: string;
  amountPence: number;
  currency: string;
  interval: PlanBillingInterval;
  status: string;
  nextPaymentDate: string | null;
  checkoutUrl: string | null;
  canManagePaymentMethod: boolean;
};

export type PortalBillingStripeInvoice = {
  id: string;
  number: string | null;
  status: string;
  amountPaidPence: number;
  currency: string;
  paidAt: string | null;
  hostedInvoiceUrl: string | null;
  invoicePdf: string | null;
};

export type PortalBillingAgencyInvoice = {
  id: string;
  invoiceNumber: string | null;
  status: string;
  totalPence: number;
  currency: string | null;
  dueAt: string | null;
  paidAt: string | null;
  publicToken: string | null;
};

export type PortalBillingBundle = {
  subscriptions: PortalBillingSubscription[];
  pendingSetup: PortalBillingSubscription[];
  activeSubscriptions: PortalBillingSubscription[];
  stripeInvoices: PortalBillingStripeInvoice[];
  agencyInvoices: PortalBillingAgencyInvoice[];
  canManagePaymentMethod: boolean;
};

function stripe() {
  return new Stripe(getStripeClientSecret());
}

function mapInterval(raw: unknown): PlanBillingInterval {
  return raw === 'year' ? 'year' : 'month';
}

export function createPortalBillingService(client: SupabaseClient) {
  return new PortalBillingService(client);
}

class PortalBillingService {
  constructor(private readonly client: SupabaseClient) {}

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- G2/G3 columns pending typegen
  private get db(): any {
    return this.client;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- G2/G3 columns pending typegen
  private get admin(): any {
    return getSupabaseServerAdminClient();
  }

  private async ensureMember(clientOrgId: string) {
    const auth = await requireUser(this.client);
    if (!auth.data) throw new Error('Unauthorised');

    const { data: member } = await this.db
      .from('client_members')
      .select('id')
      .eq('client_org_id', clientOrgId)
      .eq('user_id', auth.data.id)
      .maybeSingle();

    if (!member) throw new Error('Forbidden');
    return auth.data;
  }

  private async resolveConnectAccount(accountId: string): Promise<{
    stripeAccountId: string;
    portalConfigurationId: string | null;
  } | null> {
    const { data: settings } = await this.admin
      .from('account_payment_settings')
      .select(
        'stripe_account_id, stripe_connect_enabled, stripe_billing_portal_configuration_id',
      )
      .eq('account_id', accountId)
      .maybeSingle();

    if (settings?.stripe_connect_enabled && settings.stripe_account_id) {
      return {
        stripeAccountId: String(settings.stripe_account_id),
        portalConfigurationId: settings.stripe_billing_portal_configuration_id
          ? String(settings.stripe_billing_portal_configuration_id)
          : null,
      };
    }

    const { data: business } = await this.admin
      .from('businesses')
      .select('id')
      .eq('account_id', accountId)
      .maybeSingle();

    if (!business?.id) return null;

    const { data: agency } = await this.admin
      .from('agency_stripe')
      .select('stripe_account_id, stripe_connect_enabled')
      .eq('business_id', business.id)
      .maybeSingle();

    if (!agency?.stripe_connect_enabled || !agency.stripe_account_id) {
      return null;
    }

    return {
      stripeAccountId: String(agency.stripe_account_id),
      portalConfigurationId: null,
    };
  }

  /**
   * Configure connected-account Billing Portal: payment method + invoice history only.
   * Plan switching and customer cancellation stay disabled (agency-managed).
   */
  async ensureBillingPortalConfiguration(
    accountId: string,
    stripeAccountId: string,
    existingConfigurationId?: string | null,
  ): Promise<string> {
    const s = stripe();
    const features: Stripe.BillingPortal.ConfigurationCreateParams.Features = {
      customer_update: {
        enabled: true,
        allowed_updates: ['email', 'address', 'name', 'phone'],
      },
      invoice_history: { enabled: true },
      payment_method_update: { enabled: true },
      subscription_cancel: { enabled: false },
      subscription_update: { enabled: false },
    };

    if (existingConfigurationId) {
      try {
        const updated = await s.billingPortal.configurations.update(
          existingConfigurationId,
          { features },
          { stripeAccount: stripeAccountId },
        );
        return updated.id;
      } catch (err) {
        // Only recreate when the stored configuration is gone; rethrow other Stripe failures.
        if (
          !(
            err instanceof Stripe.errors.StripeError &&
            err.code === 'resource_missing'
          )
        ) {
          throw err;
        }
      }
    }

    const created = await s.billingPortal.configurations.create(
      {
        business_profile: {
          headline: 'Manage your payment details',
        },
        features,
      },
      { stripeAccount: stripeAccountId },
    );

    const { data: existingSettings } = await this.admin
      .from('account_payment_settings')
      .select('account_id')
      .eq('account_id', accountId)
      .maybeSingle();

    if (existingSettings) {
      await this.admin
        .from('account_payment_settings')
        .update({
          stripe_billing_portal_configuration_id: created.id,
        })
        .eq('account_id', accountId);
    } else {
      await this.admin.from('account_payment_settings').insert({
        account_id: accountId,
        stripe_billing_portal_configuration_id: created.id,
      });
    }

    return created.id;
  }

  async getBillingBundle(
    accountId: string,
    clientOrgId: string,
  ): Promise<PortalBillingBundle> {
    await this.ensureMember(clientOrgId);

    const { data: clients } = await this.db
      .from('clients')
      .select('id, stripe_customer_id_connect')
      .eq('client_org_id', clientOrgId)
      .eq('account_id', accountId);

    const clientIds = ((clients ?? []) as Array<{ id: string }>).map(
      (row) => row.id,
    );

    const [byOrg, byClient] = await Promise.all([
      this.admin
        .from('client_subscriptions')
        .select(
          'id, plan_name, monthly_amount, currency, status, next_billing_date, current_period_end, stripe_payment_link, stripe_customer_id, stripe_customer_id_connect, stripe_subscription_id, subscription_kind, plan_template_id, client_id, created_at',
        )
        .eq('client_org_id', clientOrgId)
        .eq('account_id', accountId)
        .order('created_at', { ascending: false }),
      clientIds.length > 0
        ? this.admin
            .from('client_subscriptions')
            .select(
              'id, plan_name, monthly_amount, currency, status, next_billing_date, current_period_end, stripe_payment_link, stripe_customer_id, stripe_customer_id_connect, stripe_subscription_id, subscription_kind, plan_template_id, client_id, created_at',
            )
            .in('client_id', clientIds)
            .eq('account_id', accountId)
            .order('created_at', { ascending: false })
        : Promise.resolve({ data: [] as unknown[] }),
    ]);

    const subRowsMap = new Map<string, Record<string, unknown>>();
    for (const row of [
      ...((byOrg.data ?? []) as Array<Record<string, unknown>>),
      ...((byClient.data ?? []) as Array<Record<string, unknown>>),
    ]) {
      subRowsMap.set(String(row.id), row);
    }
    const subRows = [...subRowsMap.values()];

    const { data: lineRows } = await this.admin
      .from('subscription_line_items')
      .select('client_subscription_id, billing_interval')
      .eq('account_id', accountId)
      .eq('item_type', 'recurring_price');

    const intervalBySub = new Map<string, PlanBillingInterval>();
    for (const row of (lineRows ?? []) as Array<Record<string, unknown>>) {
      intervalBySub.set(
        String(row.client_subscription_id),
        mapInterval(row.billing_interval),
      );
    }

    const connect = await this.resolveConnectAccount(accountId);
    const customerIds = new Set<string>();

    const uniqueSubs: PortalBillingSubscription[] = subRows.map((row) => {
      const customerId =
        (row.stripe_customer_id_connect as string | null) ??
        (row.stripe_customer_id as string | null);
      if (customerId) customerIds.add(customerId);

      const status = String(row.status ?? 'pending');
      const checkoutUrl =
        status === 'incomplete' || status === 'pending'
          ? (row.stripe_payment_link as string | null)
          : null;

      return {
        id: String(row.id),
        planName:
          String(row.plan_name ?? 'Subscription').trim() || 'Subscription',
        amountPence: Number(row.monthly_amount ?? 0),
        currency: String(row.currency ?? 'gbp').toLowerCase(),
        interval: intervalBySub.get(String(row.id)) ?? 'month',
        status,
        nextPaymentDate:
          (row.current_period_end as string | null) ??
          (row.next_billing_date as string | null),
        checkoutUrl,
        canManagePaymentMethod: Boolean(
          connect && customerId && status === 'active',
        ),
      };
    });

    const pendingSetup = uniqueSubs.filter(
      (sub) =>
        (sub.status === 'incomplete' || sub.status === 'pending') &&
        Boolean(sub.checkoutUrl),
    );
    const activeSubscriptions = uniqueSubs.filter(
      (sub) => sub.status === 'active' || sub.status === 'overdue',
    );

    for (const row of (clients ?? []) as Array<{
      stripe_customer_id_connect?: string | null;
    }>) {
      if (row.stripe_customer_id_connect) {
        customerIds.add(row.stripe_customer_id_connect);
      }
    }

    let agencyInvoices: PortalBillingAgencyInvoice[] = [];
    if (clientIds.length > 0) {
      const { data: invoices } = await this.db
        .from('invoices')
        .select(
          'id, invoice_number, status, total_pence, currency, due_at, paid_at, public_token',
        )
        .in('client_id', clientIds)
        .order('due_at', { ascending: false });

      agencyInvoices = ((invoices ?? []) as Array<Record<string, unknown>>).map(
        (row) => ({
          id: String(row.id),
          invoiceNumber: (row.invoice_number as string | null) ?? null,
          status: String(row.status ?? 'draft'),
          totalPence: Number(row.total_pence ?? 0),
          currency: (row.currency as string | null) ?? null,
          dueAt: (row.due_at as string | null) ?? null,
          paidAt: (row.paid_at as string | null) ?? null,
          publicToken: (row.public_token as string | null) ?? null,
        }),
      );
    }

    let stripeInvoices: PortalBillingStripeInvoice[] = [];
    if (connect && customerIds.size > 0) {
      for (const customerId of customerIds) {
        const cached = await this.getCachedStripeInvoices(
          accountId,
          connect.stripeAccountId,
          customerId,
        );
        stripeInvoices = stripeInvoices.concat(cached);
      }
      stripeInvoices.sort((a, b) => {
        const at = a.paidAt ? Date.parse(a.paidAt) : 0;
        const bt = b.paidAt ? Date.parse(b.paidAt) : 0;
        return bt - at;
      });
    }

    return {
      subscriptions: uniqueSubs,
      pendingSetup,
      activeSubscriptions,
      stripeInvoices,
      agencyInvoices,
      canManagePaymentMethod: uniqueSubs.some((s) => s.canManagePaymentMethod),
    };
  }

  private async getCachedStripeInvoices(
    accountId: string,
    stripeAccountId: string,
    stripeCustomerId: string,
  ): Promise<PortalBillingStripeInvoice[]> {
    const { data: cached } = await this.admin
      .from('portal_billing_invoice_cache')
      .select('invoices, fetched_at')
      .eq('stripe_account_id', stripeAccountId)
      .eq('stripe_customer_id', stripeCustomerId)
      .maybeSingle();

    const fetchedAt = cached?.fetched_at
      ? Date.parse(String(cached.fetched_at))
      : 0;
    const fresh =
      fetchedAt > 0 && Date.now() - fetchedAt < INVOICE_CACHE_TTL_MS;

    if (fresh && Array.isArray(cached?.invoices)) {
      return cached.invoices as PortalBillingStripeInvoice[];
    }

    try {
      const list = await stripe().invoices.list(
        {
          customer: stripeCustomerId,
          status: 'paid',
          limit: 24,
        },
        { stripeAccount: stripeAccountId },
      );

      const mapped: PortalBillingStripeInvoice[] = list.data.map((invoice) => ({
        id: invoice.id,
        number: invoice.number ?? null,
        status: invoice.status ?? 'paid',
        amountPaidPence: invoice.amount_paid ?? 0,
        currency: (invoice.currency ?? 'gbp').toLowerCase(),
        paidAt: invoice.status_transitions?.paid_at
          ? new Date(invoice.status_transitions.paid_at * 1000).toISOString()
          : invoice.created
            ? new Date(invoice.created * 1000).toISOString()
            : null,
        hostedInvoiceUrl: invoice.hosted_invoice_url ?? null,
        invoicePdf: invoice.invoice_pdf ?? null,
      }));

      await this.admin.from('portal_billing_invoice_cache').upsert(
        {
          account_id: accountId,
          stripe_account_id: stripeAccountId,
          stripe_customer_id: stripeCustomerId,
          invoices: mapped,
          fetched_at: new Date().toISOString(),
        },
        { onConflict: 'stripe_account_id,stripe_customer_id' },
      );

      return mapped;
    } catch (error) {
      console.error('[portal-billing] stripe invoice list failed', error);
      if (Array.isArray(cached?.invoices)) {
        return cached.invoices as PortalBillingStripeInvoice[];
      }
      return [];
    }
  }

  /**
   * Short-lived Stripe Billing Portal URL for payment-method update (+ invoice history).
   * Cancellation / plan changes are disabled on the configuration.
   */
  async createManagePaymentSession(input: {
    clientOrgId: string;
    clientSlug: string;
  }): Promise<{ url: string }> {
    await this.ensureMember(input.clientOrgId);

    // Derive workspace from the org — never trust a client-supplied accountId.
    const { data: org } = await this.admin
      .from('client_orgs')
      .select('id, business_id, slug')
      .eq('id', input.clientOrgId)
      .maybeSingle();

    if (!org?.business_id) {
      throw new Error('Forbidden');
    }

    if (
      String(org.slug ?? '').toLowerCase() !==
      input.clientSlug.trim().toLowerCase()
    ) {
      throw new Error('Forbidden');
    }

    const accountId = String(org.business_id);

    const connect = await this.resolveConnectAccount(accountId);
    if (!connect) {
      throw new Error(
        'Card management is not available for this workspace yet',
      );
    }

    const { data: clients } = await this.admin
      .from('clients')
      .select('id, stripe_customer_id_connect')
      .eq('client_org_id', input.clientOrgId)
      .eq('account_id', accountId);

    const { data: subs } = await this.admin
      .from('client_subscriptions')
      .select('stripe_customer_id_connect, stripe_customer_id, status')
      .eq('client_org_id', input.clientOrgId)
      .eq('account_id', accountId)
      .eq('status', 'active');

    const customerId =
      ((clients ?? []) as Array<{ stripe_customer_id_connect?: string | null }>)
        .map((row) => row.stripe_customer_id_connect)
        .find(Boolean) ??
      (
        (subs ?? []) as Array<{
          stripe_customer_id_connect?: string | null;
          stripe_customer_id?: string | null;
        }>
      )
        .map((row) => row.stripe_customer_id_connect ?? row.stripe_customer_id)
        .find(Boolean);

    if (!customerId) {
      throw new Error(
        'No active payment customer found. Complete setup first.',
      );
    }

    const configurationId = await this.ensureBillingPortalConfiguration(
      accountId,
      connect.stripeAccountId,
      connect.portalConfigurationId,
    );

    const origin = getSiteOrigin();
    const returnUrl = `${origin}/portal/${encodeURIComponent(input.clientSlug)}/billing`;

    const session = await stripe().billingPortal.sessions.create(
      {
        customer: customerId,
        return_url: returnUrl,
        configuration: configurationId,
      },
      { stripeAccount: connect.stripeAccountId },
    );

    if (!session.url) {
      throw new Error('Could not open the billing portal');
    }

    return { url: session.url };
  }
}

/** Called after Connect OAuth to pre-configure the customer portal. */
export async function configureConnectBillingPortal(
  accountId: string,
  stripeAccountId: string,
) {
  const service = createPortalBillingService(getSupabaseServerAdminClient());
  await service.ensureBillingPortalConfiguration(
    accountId,
    stripeAccountId,
    null,
  );
}

/** Drop cached Stripe invoice history after a subscription invoice is paid. */
export async function invalidatePortalBillingInvoiceCache(input: {
  stripeAccountId?: string | null;
  stripeCustomerId?: string | null;
}) {
  if (!input.stripeCustomerId) return;
  const admin = getSupabaseServerAdminClient() as any; // eslint-disable-line @typescript-eslint/no-explicit-any -- cache table pending typegen
  let query = admin
    .from('portal_billing_invoice_cache')
    .delete()
    .eq('stripe_customer_id', input.stripeCustomerId);
  if (input.stripeAccountId) {
    query = query.eq('stripe_account_id', input.stripeAccountId);
  }
  await query;
}
