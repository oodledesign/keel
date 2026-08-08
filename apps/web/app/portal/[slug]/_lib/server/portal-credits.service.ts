import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import { requireUser } from '@kit/supabase/require-user';
import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

import { createCreditTopupInvoice } from '~/lib/credits/create-credit-topup-invoice';
import type { RequestTypeRecord } from '~/lib/credits/request-types-types';

import {
  PORTAL_CREDIT_TOPUP_PACKS,
  type PortalCreditTransaction,
  type PortalCreditsBundle,
} from '../types/portal-credits.types';

export type { PortalCreditsBundle, PortalCreditTransaction };
export { PORTAL_CREDIT_TOPUP_PACKS };

function mapRequestType(row: Record<string, unknown>): RequestTypeRecord {
  return {
    id: String(row.id),
    accountId: String(row.account_id),
    businessId: row.business_id ? String(row.business_id) : null,
    label: String(row.label ?? ''),
    creditCost: Number(row.credit_cost ?? 0),
    isBillable: Boolean(row.is_billable ?? true),
    isSupport: Boolean(row.is_support ?? false),
    categoryGroup: row.category_group ? String(row.category_group) : null,
    sortOrder: Number(row.sort_order ?? 0),
    isActive: Boolean(row.is_active ?? true),
    createdAt: String(row.created_at ?? ''),
    updatedAt: String(row.updated_at ?? ''),
  };
}

export function createPortalCreditsService(client: SupabaseClient) {
  return new PortalCreditsService(client);
}

class PortalCreditsService {
  private readonly admin = getSupabaseServerAdminClient() as any;

  constructor(private readonly client: SupabaseClient) {}

  private get db(): any {
    return this.client;
  }

  private async ensureMember(clientOrgId: string) {
    const { data: user, error } = await requireUser(this.client);
    if (error || !user) throw new Error('Authentication required');

    const { data: membership, error: membershipError } = await this.db
      .from('client_members')
      .select('id')
      .eq('client_org_id', clientOrgId)
      .eq('user_id', user.id)
      .maybeSingle();

    if (membershipError || !membership) {
      throw new Error('Permission denied');
    }

    return user;
  }

  private async resolveAccountIdFromOrg(clientOrgId: string): Promise<string> {
    const { data: org } = await this.admin
      .from('client_orgs')
      .select('id, business_id')
      .eq('id', clientOrgId)
      .maybeSingle();

    if (!org?.business_id) throw new Error('Forbidden');

    const { data: business } = await this.admin
      .from('businesses')
      .select('account_id')
      .eq('id', org.business_id)
      .maybeSingle();

    return business?.account_id
      ? String(business.account_id)
      : String(org.business_id);
  }

  private async resolveAccountId(
    clientOrgId: string,
    clientSlug: string,
  ): Promise<string> {
    const { data: org } = await this.admin
      .from('client_orgs')
      .select('id, business_id, slug')
      .eq('id', clientOrgId)
      .maybeSingle();

    if (!org?.business_id) throw new Error('Forbidden');
    if (
      String(org.slug ?? '').toLowerCase() !== clientSlug.trim().toLowerCase()
    ) {
      throw new Error('Forbidden');
    }

    const { data: business } = await this.admin
      .from('businesses')
      .select('account_id')
      .eq('id', org.business_id)
      .maybeSingle();

    return business?.account_id
      ? String(business.account_id)
      : String(org.business_id);
  }

  private async resolveClientId(
    accountId: string,
    clientOrgId: string,
  ): Promise<string> {
    const { data: client } = await this.admin
      .from('clients')
      .select('id')
      .eq('account_id', accountId)
      .eq('client_org_id', clientOrgId)
      .limit(1)
      .maybeSingle();

    if (!client?.id) {
      throw new Error(
        'No client record is linked to this organisation yet. Ask your agency to connect it.',
      );
    }

    return String(client.id);
  }

  async listActiveRequestTypes(clientOrgId: string): Promise<
    Array<{
      id: string;
      label: string;
      creditCost: number;
      isBillable: boolean;
      isSupport: boolean;
      categoryGroup: string | null;
    }>
  > {
    await this.ensureMember(clientOrgId);
    const accountId = await this.resolveAccountIdFromOrg(clientOrgId);

    const { data, error } = await this.admin
      .from('request_types')
      .select(
        'id, account_id, business_id, label, credit_cost, is_billable, is_support, category_group, sort_order, is_active, created_at, updated_at',
      )
      .eq('account_id', accountId)
      .eq('is_active', true)
      .order('sort_order', { ascending: true })
      .order('label', { ascending: true });

    if (error) throw error;

    return (data ?? []).map((row: Record<string, unknown>) => {
      const mapped = mapRequestType(row);
      return {
        id: mapped.id,
        label: mapped.label,
        creditCost: mapped.creditCost,
        isBillable: mapped.isBillable,
        isSupport: mapped.isSupport,
        categoryGroup: mapped.categoryGroup,
      };
    });
  }

  async getCreditsBundle(clientOrgId: string): Promise<PortalCreditsBundle> {
    await this.ensureMember(clientOrgId);
    const accountId = await this.resolveAccountIdFromOrg(clientOrgId);

    const [poolRes, txRes, typesRes, pendingRes, subRes] = await Promise.all([
      this.admin
        .from('client_credit_pools')
        .select('balance, cycle_start, cycle_end')
        .eq('client_org_id', clientOrgId)
        .maybeSingle(),
      this.admin
        .from('client_credit_transactions')
        .select('id, type, amount, reason, created_at, related_ticket_id')
        .eq('client_org_id', clientOrgId)
        .order('created_at', { ascending: false })
        .limit(50),
      this.admin
        .from('request_types')
        .select(
          'id, label, credit_cost, is_billable, is_support, category_group, sort_order',
        )
        .eq('account_id', accountId)
        .eq('is_active', true)
        .order('sort_order', { ascending: true }),
      this.admin
        .from('support_tickets')
        .select('id', { count: 'exact', head: true })
        .eq('client_org_id', clientOrgId)
        .eq('status', 'pending_credits'),
      this.admin
        .from('client_subscriptions')
        .select(
          'id, next_billing_date, status, plan_template_id, plan_templates(name, credits_per_cycle, rollover_policy, rollover_cap)',
        )
        .eq('client_org_id', clientOrgId)
        .eq('account_id', accountId)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    const pool = poolRes.data as {
      balance?: number;
      cycle_start?: string | null;
      cycle_end?: string | null;
    } | null;

    const sub = subRes.data as {
      next_billing_date?: string | null;
      plan_templates?:
        | {
            name?: string | null;
            credits_per_cycle?: number | null;
            rollover_policy?: string | null;
            rollover_cap?: number | null;
          }
        | {
            name?: string | null;
            credits_per_cycle?: number | null;
            rollover_policy?: string | null;
            rollover_cap?: number | null;
          }[]
        | null;
    } | null;

    const plan = Array.isArray(sub?.plan_templates)
      ? sub?.plan_templates[0]
      : sub?.plan_templates;

    const policy = plan?.rollover_policy;
    const rolloverPolicy =
      policy === 'expire' || policy === 'rollover' || policy === 'cap'
        ? policy
        : null;

    return {
      balance: Number(pool?.balance ?? 0),
      cycleStart: pool?.cycle_start ? String(pool.cycle_start) : null,
      cycleEnd: pool?.cycle_end ? String(pool.cycle_end) : null,
      rolloverPolicy,
      rolloverCap:
        typeof plan?.rollover_cap === 'number' ? plan.rollover_cap : null,
      creditsPerCycle:
        typeof plan?.credits_per_cycle === 'number'
          ? plan.credits_per_cycle
          : null,
      planName: plan?.name ? String(plan.name) : null,
      nextRenewalDate: sub?.next_billing_date
        ? String(sub.next_billing_date)
        : pool?.cycle_end
          ? String(pool.cycle_end)
          : null,
      transactions: ((txRes.data ?? []) as Array<Record<string, unknown>>).map(
        (row) => ({
          id: String(row.id),
          type: String(row.type ?? ''),
          amount: Number(row.amount ?? 0),
          reason: row.reason ? String(row.reason) : null,
          createdAt: String(row.created_at ?? ''),
          relatedTicketId: row.related_ticket_id
            ? String(row.related_ticket_id)
            : null,
        }),
      ),
      requestTypes: (
        (typesRes.data ?? []) as Array<Record<string, unknown>>
      ).map((row) => ({
        id: String(row.id),
        label: String(row.label ?? ''),
        creditCost: Number(row.credit_cost ?? 0),
        isBillable: Boolean(row.is_billable ?? true),
        isSupport: Boolean(row.is_support ?? false),
        categoryGroup: row.category_group ? String(row.category_group) : null,
      })),
      topupPacks: PORTAL_CREDIT_TOPUP_PACKS.map((pack) => ({ ...pack })),
      pendingCreditTicketCount: pendingRes.count ?? 0,
    };
  }

  async createTopupInvoice(input: {
    clientOrgId: string;
    clientSlug: string;
    packId: string;
  }) {
    await this.ensureMember(input.clientOrgId);
    const accountId = await this.resolveAccountId(
      input.clientOrgId,
      input.clientSlug,
    );
    const clientId = await this.resolveClientId(accountId, input.clientOrgId);

    const pack = PORTAL_CREDIT_TOPUP_PACKS.find(
      (row) => row.id === input.packId,
    );
    if (!pack) throw new Error('Unknown top-up pack');

    return createCreditTopupInvoice({
      accountId,
      clientId,
      units: pack.units,
      totalPence: pack.totalPence,
      description: `${pack.label} top-up`,
      asSystem: true,
    });
  }
}
