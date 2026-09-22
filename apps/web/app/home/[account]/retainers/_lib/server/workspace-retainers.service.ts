import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import { requireUser } from '@kit/supabase/require-user';

import { isVisibleAgencyClientSubscription } from '~/lib/billing/client-subscription-lifecycle';
import {
  type ClientSubscriptionRecord,
  type PlanTemplateKind,
  parseBillingCollection,
} from '~/lib/billing/plan-templates-types';
import { RETAINER_WORKSPACE_ROLES } from '~/lib/retainers/constants';
import { looseClient } from '~/lib/retainers/loose-client';
import {
  type WorkspaceRetainerClientChoice,
  type WorkspaceRetainerProjectChoice,
  type WorkspaceRetainerRow,
  buildWorkspaceRetainerRows,
  parsePlanBillingInterval,
} from '~/lib/retainers/workspace-retainers';

import type { LinkWorkspaceRetainerToProjectInput } from '../schema/workspace-retainers.schema';

function clientDisplayName(row: {
  display_name?: string | null;
  company_name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
}) {
  const display = row.display_name?.trim();
  if (display) return display;
  const company = row.company_name?.trim();
  if (company) return company;
  const name = [row.first_name, row.last_name]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(' ');
  return name || 'Client';
}

function mapSubscriptionRow(
  row: Record<string, unknown>,
): ClientSubscriptionRecord {
  return {
    id: String(row.id),
    accountId: String(row.account_id ?? ''),
    businessId: row.business_id ? String(row.business_id) : null,
    clientId: row.client_id ? String(row.client_id) : null,
    clientOrgId: row.client_org_id ? String(row.client_org_id) : null,
    websiteId: row.website_id ? String(row.website_id) : null,
    projectId: row.project_id ? String(row.project_id) : null,
    planTemplateId: row.plan_template_id ? String(row.plan_template_id) : null,
    planName: row.plan_name ? String(row.plan_name) : null,
    subscriptionKind: (row.subscription_kind as PlanTemplateKind) ?? null,
    monthlyAmount: Number(row.monthly_amount ?? 0),
    currency: String(row.currency ?? 'gbp').toLowerCase(),
    status: (row.status as ClientSubscriptionRecord['status']) ?? 'pending',
    billingCollection: parseBillingCollection(row.billing_collection),
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

export function createWorkspaceRetainersService(client: SupabaseClient) {
  return new WorkspaceRetainersService(client);
}

class WorkspaceRetainersService {
  constructor(private readonly client: SupabaseClient) {}

  private async ensureMember(accountId: string) {
    const auth = await requireUser(this.client);
    if (!auth.data) throw new Error('Unauthorised');
    const { data: membership } = await this.client
      .from('accounts_memberships')
      .select('account_role')
      .eq('account_id', accountId)
      .eq('user_id', auth.data.id)
      .maybeSingle();
    const role = membership?.account_role as string | undefined;
    if (!role || !RETAINER_WORKSPACE_ROLES.has(role)) {
      throw new Error('Forbidden');
    }
  }

  async list(accountId: string): Promise<{
    rows: WorkspaceRetainerRow[];
    clients: WorkspaceRetainerClientChoice[];
    projects: WorkspaceRetainerProjectChoice[];
  }> {
    await this.ensureMember(accountId);

    const [{ data: clientRows }, { data: projectRows }, { data: subRows }] =
      await Promise.all([
        this.client
          .from('clients')
          .select('id, display_name, company_name, first_name, last_name')
          .eq('account_id', accountId)
          .order('display_name', { ascending: true }),
        this.client
          .from('projects')
          .select('id, title, name, status, client_id')
          .eq('account_id', accountId)
          .order('updated_at', { ascending: false }),
        // TODO: remove looseClient after supabase:web:typegen includes project_id.
        looseClient(this.client)
          .from('client_subscriptions')
          .select('*')
          .eq('account_id', accountId)
          .order('created_at', { ascending: false }),
      ]);

    const clients = (
      (clientRows ?? []) as Array<{
        id: string;
        display_name?: string | null;
        company_name?: string | null;
        first_name?: string | null;
        last_name?: string | null;
      }>
    ).map((row) => ({
      id: String(row.id),
      name: clientDisplayName(row),
    }));

    const projects = (
      (projectRows ?? []) as Array<{
        id: string;
        title?: string | null;
        name?: string | null;
        client_id?: string | null;
      }>
    ).map((row) => ({
      id: String(row.id),
      title: String(row.title ?? row.name ?? 'Project').trim() || 'Project',
      clientId: row.client_id ? String(row.client_id) : null,
    }));

    const subscriptions = (
      (subRows ?? []) as Array<Record<string, unknown>>
    ).map(mapSubscriptionRow);

    const projectIds = projects.map((row) => row.id);
    const balances = new Map<string, number>();

    if (projectIds.length > 0) {
      // TODO: remove looseClient after supabase:web:typegen includes project_retainers.
      const { data: retainerRows } = await looseClient(this.client)
        .from('project_retainers')
        .select('project_id, credit_balance')
        .eq('account_id', accountId)
        .in('project_id', projectIds);

      for (const row of (retainerRows ?? []) as Array<{
        project_id?: string;
        credit_balance?: number;
      }>) {
        if (!row.project_id) continue;
        const balance = Number(row.credit_balance ?? 0);
        if (Number.isFinite(balance) && balance > 0) {
          balances.set(String(row.project_id), balance);
        }
      }
    }

    const templateIds = [
      ...new Set(
        subscriptions
          .map((row) => row.planTemplateId)
          .filter((id): id is string => Boolean(id)),
      ),
    ];
    const intervals = new Map<
      string,
      ReturnType<typeof parsePlanBillingInterval>
    >();

    if (templateIds.length > 0) {
      // TODO: remove looseClient after supabase:web:typegen includes plan_templates.
      const { data: templateRows } = await looseClient(this.client)
        .from('plan_templates')
        .select('id, billing_interval')
        .eq('account_id', accountId)
        .in('id', templateIds);

      for (const row of (templateRows ?? []) as Array<{
        id?: string;
        billing_interval?: string;
      }>) {
        if (!row.id) continue;
        intervals.set(
          String(row.id),
          parsePlanBillingInterval(row.billing_interval),
        );
      }
    }

    return buildWorkspaceRetainerRows({
      clients,
      projects,
      balances,
      subscriptions,
      intervals,
    });
  }

  /**
   * Attach a legacy client-level subscription (project_id null) to a project
   * in the same workspace. Credits stay on project_retainers once linked.
   */
  async linkToProject(
    input: LinkWorkspaceRetainerToProjectInput,
  ): Promise<{ projectId: string; subscriptionId: string }> {
    await this.ensureMember(input.accountId);

    const { data: subscription, error: subError } = await looseClient(
      this.client,
    )
      .from('client_subscriptions')
      .select('id, account_id, client_id, project_id, plan_template_id, status')
      .eq('id', input.subscriptionId)
      .eq('account_id', input.accountId)
      .maybeSingle();

    if (subError) throw new Error(subError.message);
    if (!subscription) throw new Error('Retainer not found');

    const existingProjectId = subscription.project_id
      ? String(subscription.project_id)
      : null;
    if (existingProjectId) {
      throw new Error('This retainer is already linked to a project');
    }

    const clientId = subscription.client_id
      ? String(subscription.client_id)
      : null;
    if (!clientId) {
      throw new Error('This retainer has no client to match projects against');
    }

    const { data: project, error: projectError } = await this.client
      .from('projects')
      .select('id, client_id')
      .eq('id', input.projectId)
      .eq('account_id', input.accountId)
      .maybeSingle();

    if (projectError) throw new Error(projectError.message);
    if (!project) throw new Error('Project not found');

    const projectClientId = (project as { client_id?: string | null })
      .client_id;
    if (projectClientId && projectClientId !== clientId) {
      throw new Error('Project does not belong to this client');
    }
    if (!projectClientId) {
      throw new Error('Choose a project that belongs to this client');
    }

    const planTemplateId = subscription.plan_template_id
      ? String(subscription.plan_template_id)
      : null;

    const { data: existingOnProject, error: conflictError } = await looseClient(
      this.client,
    )
      .from('client_subscriptions')
      .select('id, status, plan_template_id')
      .eq('account_id', input.accountId)
      .eq('project_id', input.projectId)
      .is('website_id', null);

    if (conflictError) throw new Error(conflictError.message);

    const conflicting = (
      (existingOnProject ?? []) as Array<{
        id?: string;
        status?: string | null;
        plan_template_id?: string | null;
      }>
    ).find((row) => {
      if (!isVisibleAgencyClientSubscription(row.status)) return false;
      if (!planTemplateId) return true;
      return String(row.plan_template_id ?? '') === planTemplateId;
    });

    if (conflicting) {
      throw new Error(
        planTemplateId
          ? 'This project already has a live retainer for the same plan'
          : 'This project already has a live retainer',
      );
    }

    const { data: updated, error: updateError } = await looseClient(this.client)
      .from('client_subscriptions')
      .update({ project_id: input.projectId })
      .eq('id', input.subscriptionId)
      .eq('account_id', input.accountId)
      .is('project_id', null)
      .select('id')
      .maybeSingle();

    if (updateError) throw new Error(updateError.message);
    if (!updated) {
      throw new Error('Could not link retainer — it may already be linked');
    }

    return {
      projectId: input.projectId,
      subscriptionId: input.subscriptionId,
    };
  }
}
