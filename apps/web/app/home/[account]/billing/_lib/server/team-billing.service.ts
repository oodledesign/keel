import 'server-only';

import { SupabaseClient } from '@supabase/supabase-js';

import { z } from 'zod';

import { LineItemSchema } from '@kit/billing';
import { getBillingGatewayProvider } from '@kit/billing-gateway';
import { getLogger } from '@kit/shared/logger';
import { requireUser } from '@kit/supabase/require-user';
import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { createTeamAccountsApi } from '@kit/team-accounts/api';

import appConfig from '~/config/app.config';
import billingConfig from '~/config/billing.config';
import pathsConfig from '~/config/paths.config';
import { getTeamAccountAccess } from '~/home/[account]/_lib/role-access';
import { Database } from '~/lib/database.types';

import { TeamCheckoutSchema } from '../schema/team-billing.schema';

export function createTeamBillingService(client: SupabaseClient<Database>) {
  return new TeamBillingService(client);
}

/**
 * @name TeamBillingService
 * @description Service for managing billing for team accounts.
 */
class TeamBillingService {
  private readonly namespace = 'billing.team-account';

  constructor(private readonly client: SupabaseClient<Database>) {}

  /**
   * Aligns with UI `canManageBilling`: `billing.manage` OR owner/admin.
   * Makerkit `has_permission` alone rejects owners whose role row lacks the flag.
   */
  private async assertCanManageBilling(params: {
    userId: string;
    accountId: string;
    action: string;
  }) {
    const { userId, accountId, action } = params;
    const logger = await getLogger();
    const api = createTeamAccountsApi(this.client);

    const hasPermission = await api.hasPermission({
      userId,
      accountId,
      permission: 'billing.manage',
    });

    if (hasPermission) {
      return;
    }

    const [{ data: account }, { data: membership }] = await Promise.all([
      this.client
        .from('accounts')
        .select('primary_owner_user_id')
        .eq('id', accountId)
        .maybeSingle(),
      this.client
        .from('accounts_memberships')
        .select('account_role, company_role')
        .eq('account_id', accountId)
        .eq('user_id', userId)
        .maybeSingle(),
    ]);

    const isPrimaryOwner = account?.primary_owner_user_id === userId;
    const access = getTeamAccountAccess({
      role: membership?.account_role ?? null,
      company_role: membership?.company_role ?? null,
      permissions: [],
    });

    if (isPrimaryOwner || access.canManageBilling) {
      return;
    }

    logger.warn(
      {
        userId,
        accountId,
        action,
        name: this.namespace,
        accountRole: membership?.account_role ?? null,
        companyRole: membership?.company_role ?? null,
      },
      `User without billing access attempted ${action}.`,
    );

    throw new Error(
      'You do not have permission to manage billing for this workspace.',
    );
  }

  /**
   * @name createCheckout
   * @description Creates a checkout session for a Team account
   */
  async createCheckout(params: z.infer<typeof TeamCheckoutSchema>) {
    // we require the user to be authenticated
    const { data: user } = await requireUser(this.client);

    if (!user) {
      throw new Error('Authentication required');
    }

    const userId = user.id;
    const accountId = params.accountId;
    const logger = await getLogger();

    const ctx = {
      userId,
      accountId,
      name: this.namespace,
    };

    logger.info(ctx, `Requested checkout session. Processing...`);

    const api = createTeamAccountsApi(this.client);

    await this.assertCanManageBilling({
      userId,
      accountId,
      action: 'create checkout',
    });

    // here we have confirmed that the user has permission to manage billing for the account
    // so we go on and create a checkout session
    const service = await getBillingGatewayProvider(this.client);

    // retrieve the plan from the configuration
    // so we can assign the correct checkout data
    const { plan, product } = getPlanDetails(params.productId, params.planId);

    // find the customer ID for the account if it exists
    // (eg. if the account has been billed before)
    const customerId = await api.getCustomerId(accountId);
    const customerEmail = user.email;

    // the return URL for the checkout session
    const returnUrl = getCheckoutSessionReturnUrl(params.slug);

    // get variant quantities
    // useful for setting an initial quantity value for certain line items
    // such as per seat
    const variantQuantities = await this.getVariantQuantities(
      plan.lineItems,
      accountId,
    );

    logger.info(
      {
        ...ctx,
        planId: plan.id,
      },
      `Creating checkout session...`,
    );

    try {
      // call the payment gateway to create the checkout session
      const { checkoutToken } = await service.createCheckoutSession({
        accountId,
        plan,
        returnUrl,
        customerEmail,
        customerId,
        variantQuantities,
        enableDiscountField: product.enableDiscountField,
      });

      // return the checkout token to the client
      // so we can call the payment gateway to complete the checkout
      return {
        checkoutToken,
      };
    } catch (error) {
      logger.error(
        {
          ...ctx,
          error,
        },
        `Error creating the checkout session`,
      );

      throw new Error(
        'Could not start checkout. Please try again, or contact support if this keeps happening.',
      );
    }
  }

  /**
   * @name createBillingPortalSession
   * @description Creates a new billing portal session for a team account
   * @param accountId
   * @param slug
   */
  async createBillingPortalSession({
    accountId,
    slug,
    intent = 'manage',
  }: {
    accountId: string;
    slug: string;
    intent?: 'manage' | 'recover';
  }) {
    const client = getSupabaseServerClient();
    const logger = await getLogger();

    logger.info(
      {
        accountId,
        intent,
        name: this.namespace,
      },
      `Billing portal session requested. Processing...`,
    );

    const { data: user, error } = await requireUser(client);

    if (error ?? !user) {
      throw new Error('Authentication required');
    }

    const userId = user.id;

    const api = createTeamAccountsApi(client);

    await this.assertCanManageBilling({
      userId,
      accountId,
      action: 'create billing portal session',
    });

    const customerId = await api.getCustomerId(accountId);

    if (!customerId) {
      throw new Error('Customer not found');
    }

    logger.info(
      {
        userId,
        customerId,
        accountId,
        intent,
        name: this.namespace,
      },
      `Creating billing portal session...`,
    );

    // get the billing gateway provider
    const service = await getBillingGatewayProvider(client);

    try {
      const returnUrl = getBillingPortalReturnUrl(slug, intent);

      const { url } = await service.createBillingPortalSession({
        customerId,
        returnUrl,
        ...(intent === 'recover'
          ? { flowData: { type: 'payment_method_update' as const } }
          : {}),
      });

      // redirect the user to the billing portal
      return url;
    } catch (error) {
      logger.error(
        {
          userId,
          customerId,
          accountId,
          intent,
          name: this.namespace,
          error,
        },
        `Billing Portal session was not created`,
      );

      throw new Error(`Error creating Billing Portal`);
    }
  }

  /**
   * Retrieves variant quantities for line items.
   */
  private async getVariantQuantities(
    lineItems: z.infer<typeof LineItemSchema>[],
    accountId: string,
  ) {
    const variantQuantities: Array<{
      quantity: number;
      variantId: string;
    }> = [];

    for (const lineItem of lineItems) {
      // check if the line item is a per seat type
      const isPerSeat = lineItem.type === 'per_seat';

      if (isPerSeat) {
        // get the current number of members in the account
        const quantity = await this.getCurrentMembersCount(accountId);

        const item = {
          quantity,
          variantId: lineItem.id,
        };

        variantQuantities.push(item);
      }
    }

    // set initial quantity for the line items
    return variantQuantities;
  }

  private async getCurrentMembersCount(accountId: string) {
    const api = createTeamAccountsApi(this.client);
    const logger = await getLogger();

    try {
      const count = await api.getMembersCount(accountId);

      return count ?? 1;
    } catch (error) {
      logger.error(
        {
          accountId,
          error,
          name: `billing.checkout`,
        },
        `Encountered an error while fetching the number of existing seats`,
      );

      return Promise.reject(error as Error);
    }
  }
}

function getCheckoutSessionReturnUrl(accountSlug: string) {
  return getAccountUrl(pathsConfig.app.accountBillingReturn, accountSlug);
}

function getBillingPortalReturnUrl(
  accountSlug: string,
  intent: 'manage' | 'recover' = 'manage',
) {
  const url = getAccountUrl(pathsConfig.app.accountBilling, accountSlug);
  if (intent === 'recover') {
    return `${url}?payment_updated=1`;
  }
  return url;
}

function getAccountUrl(path: string, slug: string) {
  return new URL(path, appConfig.url).toString().replace('[account]', slug);
}

function getPlanDetails(productId: string, planId: string) {
  const product = billingConfig.products.find(
    (product) => product.id === productId,
  );

  if (!product) {
    throw new Error('Product not found');
  }

  const plan = product?.plans.find((plan) => plan.id === planId);

  if (!plan) {
    throw new Error('Plan not found');
  }

  return { plan, product };
}
