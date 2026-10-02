import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import { requireUser } from '@kit/supabase/require-user';

import {
  consumeClientCredits,
  grantClientCredits,
} from '~/lib/credits/client-credit-ledger';
import {
  RETAINER_EDIT_ROLES,
  RETAINER_WORKSPACE_ROLES,
} from '~/lib/retainers/constants';
import {
  adjustProjectRetainerCredits,
  ensureProjectRetainer,
} from '~/lib/retainers/credit-ledger';
import type {
  CatalogueService,
  EffectiveService,
  EffectiveServiceList,
  ServiceCategory,
} from '~/lib/retainers/effective-services';
import { UNCATEGORIZED_SORT } from '~/lib/retainers/effective-services';
import {
  layersToEffectiveList,
  loadEffectiveLayers,
} from '~/lib/retainers/load-effective-layers';
import { looseClient } from '~/lib/retainers/loose-client';
import {
  mapProjectRetainer,
  mapRetainerBurn,
  mapRetainerService,
} from '~/lib/retainers/map-records';
import {
  insertScopedRetainerService,
  replaceProjectServiceList,
  resetProjectServiceList,
} from '~/lib/retainers/persist-service-list';
import type {
  ClientCreditSummary,
  ProjectRetainerBurn,
  ProjectRetainerRecord,
  RetainerServiceRecord,
} from '~/lib/retainers/types';

function db(client: SupabaseClient) {
  return looseClient(client);
}

export function createProjectRetainerService(client: SupabaseClient) {
  return new ProjectRetainerService(client);
}

class ProjectRetainerService {
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
    return { userId: auth.data.id, role };
  }

  private async requireProject(accountId: string, projectId: string) {
    const { data: project, error } = await this.client
      .from('projects')
      .select('id, client_id')
      .eq('id', projectId)
      .eq('account_id', accountId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!project) throw new Error('Project not found or access denied');
    return { clientId: (project.client_id as string | null) ?? null };
  }

  /** Portal org that owns the client's credit pool, scoped to the workspace. */
  private async resolveClientOrgId(
    accountId: string,
    clientId: string,
  ): Promise<string | null> {
    const { data: client } = await db(this.client)
      .from('clients')
      .select('client_org_id')
      .eq('id', clientId)
      .eq('account_id', accountId)
      .maybeSingle();
    return (
      (client as { client_org_id?: string | null } | null)?.client_org_id ??
      null
    );
  }

  private async loadClientCredits(
    accountId: string,
    clientId: string,
  ): Promise<ClientCreditSummary | null> {
    const { data: client } = await db(this.client)
      .from('clients')
      .select('client_org_id')
      .eq('id', clientId)
      .eq('account_id', accountId)
      .maybeSingle();
    const clientOrgId = (client as { client_org_id?: string | null } | null)
      ?.client_org_id;
    if (!clientOrgId) return null;

    const { data: batches, error } = await db(this.client)
      .from('client_credit_batches')
      .select('source_type, units_remaining, expires_at')
      .eq('client_org_id', clientOrgId)
      .eq('account_id', accountId)
      .gt('units_remaining', 0)
      .is('swept_at', null);
    if (error) throw error;

    const now = Date.now();
    const summary: ClientCreditSummary = {
      balance: 0,
      topupBalance: 0,
      nextTopupExpiry: null,
    };
    for (const batch of (batches ?? []) as Array<{
      source_type: string;
      units_remaining: number;
      expires_at: string | null;
    }>) {
      if (batch.expires_at && new Date(batch.expires_at).getTime() <= now) {
        continue;
      }
      const units = Number(batch.units_remaining) || 0;
      summary.balance += units;
      if (batch.source_type === 'topup_purchase') {
        summary.topupBalance += units;
        if (
          batch.expires_at &&
          (!summary.nextTopupExpiry ||
            batch.expires_at < summary.nextTopupExpiry)
        ) {
          summary.nextTopupExpiry = batch.expires_at;
        }
      }
    }
    return summary;
  }

  /**
   * Light presence check — does not create a retainer row.
   * True when the project has credits, allowlisted services, burn history,
   * or the linked client already has a retainer/subscription.
   */
  async hasServicesPresence(
    accountId: string,
    projectId: string,
    clientId?: string | null,
  ): Promise<boolean> {
    await this.ensureMember(accountId);
    await this.requireProject(accountId, projectId);

    const [retainerRes, allowRes, txRes, subRes, clientRes] = await Promise.all(
      [
        db(this.client)
          .from('project_retainers')
          .select('credit_balance')
          .eq('project_id', projectId)
          .eq('account_id', accountId)
          .maybeSingle(),
        db(this.client)
          .from('project_retainer_services')
          .select('service_id')
          .eq('project_id', projectId)
          .limit(1),
        db(this.client)
          .from('project_retainer_transactions')
          .select('id')
          .eq('project_id', projectId)
          .eq('account_id', accountId)
          .limit(1),
        clientId
          ? db(this.client)
              .from('client_subscriptions')
              .select('id')
              .eq('account_id', accountId)
              .eq('client_id', clientId)
              .limit(1)
          : Promise.resolve({ data: [] as Array<{ id: string }> }),
        clientId
          ? db(this.client)
              .from('clients')
              .select('retainer_services_source')
              .eq('id', clientId)
              .eq('account_id', accountId)
              .maybeSingle()
          : Promise.resolve({ data: null }),
      ],
    );

    const balance = Number(
      (retainerRes.data as { credit_balance?: number } | null)
        ?.credit_balance ?? 0,
    );
    if (Number.isFinite(balance) && balance > 0) return true;
    if ((allowRes.data ?? []).length > 0) return true;
    if ((txRes.data ?? []).length > 0) return true;
    if ((subRes.data ?? []).length > 0) return true;
    if (
      (clientRes.data as { retainer_services_source?: string } | null)
        ?.retainer_services_source === 'custom'
    ) {
      return true;
    }
    return false;
  }

  async load(
    accountId: string,
    projectId: string,
    clientId?: string | null,
  ): Promise<{
    retainer: ProjectRetainerRecord;
    catalogue: RetainerServiceRecord[];
    recent: ProjectRetainerBurn[];
    effective: EffectiveServiceList;
    library: CatalogueService[];
    categories: ServiceCategory[];
    clientCredits: ClientCreditSummary | null;
  }> {
    await this.ensureMember(accountId);
    const project = await this.requireProject(accountId, projectId);
    await ensureProjectRetainer({ projectId, accountId });
    const creditsClientId = clientId ?? project.clientId;

    const [retainerRes, allowRes, catalogueRes, txRes, clientCredits] =
      await Promise.all([
        db(this.client)
          .from('project_retainers')
          .select('*')
          .eq('project_id', projectId)
          .eq('account_id', accountId)
          .maybeSingle(),
        db(this.client)
          .from('project_retainer_services')
          .select('service_id')
          .eq('project_id', projectId),
        db(this.client)
          .from('retainer_services')
          .select('*')
          .eq('account_id', accountId)
          .order('sort_order', { ascending: true })
          .order('name', { ascending: true }),
        db(this.client)
          .from('project_retainer_transactions')
          .select('id, amount, service_id, task_id, created_at, type')
          .eq('project_id', projectId)
          .order('created_at', { ascending: false })
          .limit(12),
        creditsClientId
          ? this.loadClientCredits(accountId, creditsClientId)
          : Promise.resolve(null),
      ]);

    if (retainerRes.error) throw retainerRes.error;
    if (!retainerRes.data) throw new Error('Could not load project retainer');

    const allowedServiceIds = (
      (allowRes.data ?? []) as Array<{ service_id: string }>
    ).map((row) => row.service_id);

    const catalogue = (
      (catalogueRes.data ?? []) as Array<Record<string, unknown>>
    ).map(mapRetainerService);

    const serviceNames = new Map(catalogue.map((row) => [row.id, row.name]));
    const taskIds = [
      ...new Set(
        ((txRes.data ?? []) as Array<{ task_id: string | null }>)
          .map((row) => row.task_id)
          .filter((id): id is string => Boolean(id)),
      ),
    ];

    const taskTitles = new Map<string, string>();
    if (taskIds.length > 0) {
      const { data: tasks } = await this.client
        .from('tasks')
        .select('id, title')
        .in('id', taskIds);
      for (const task of tasks ?? []) {
        taskTitles.set(String(task.id), String(task.title ?? 'Task'));
      }
    }

    const recent = ((txRes.data ?? []) as Array<Record<string, unknown>>).map(
      (row) =>
        mapRetainerBurn({
          ...row,
          service_name: row.service_id
            ? (serviceNames.get(String(row.service_id)) ?? null)
            : null,
          task_title: row.task_id
            ? (taskTitles.get(String(row.task_id)) ?? null)
            : null,
        }),
    );

    const layers = await loadEffectiveLayers(db(this.client), {
      accountId,
      projectId,
      clientId,
    });
    const effective = layersToEffectiveList(layers);

    return {
      retainer: mapProjectRetainer(
        retainerRes.data as Record<string, unknown>,
        allowedServiceIds,
      ),
      catalogue,
      recent,
      effective,
      library: layers.workspace.filter((row) => row.scope === 'workspace'),
      categories: layers.categories,
      clientCredits,
    };
  }

  async updateSettings(input: {
    accountId: string;
    projectId: string;
    autoMatchEnabled?: boolean;
    weeklyDigestEnabled?: boolean;
    allowedServiceIds?: string[];
  }) {
    await this.ensureMember(input.accountId);
    await this.requireProject(input.accountId, input.projectId);
    await ensureProjectRetainer({
      projectId: input.projectId,
      accountId: input.accountId,
    });

    const patch: Record<string, unknown> = {};
    if (input.autoMatchEnabled !== undefined) {
      patch.auto_match_enabled = input.autoMatchEnabled;
    }
    if (input.weeklyDigestEnabled !== undefined) {
      patch.weekly_digest_enabled = input.weeklyDigestEnabled;
    }

    if (Object.keys(patch).length > 0) {
      const { error } = await db(this.client)
        .from('project_retainers')
        .update(patch)
        .eq('project_id', input.projectId)
        .eq('account_id', input.accountId);
      if (error) throw error;
    }

    if (input.allowedServiceIds) {
      const { error: delError } = await db(this.client)
        .from('project_retainer_services')
        .delete()
        .eq('project_id', input.projectId);
      if (delError) throw delError;

      if (input.allowedServiceIds.length > 0) {
        const { error: insError } = await db(this.client)
          .from('project_retainer_services')
          .insert(
            input.allowedServiceIds.map((serviceId) => ({
              project_id: input.projectId,
              service_id: serviceId,
            })),
          );
        if (insError) throw insError;
      }

      const { error: sourceError } = await db(this.client)
        .from('project_retainers')
        .update({ services_source: 'custom' })
        .eq('project_id', input.projectId)
        .eq('account_id', input.accountId);
      if (sourceError) throw sourceError;
    }

    return this.load(input.accountId, input.projectId);
  }

  async replaceServices(input: {
    accountId: string;
    projectId: string;
    clientId?: string | null;
    services: EffectiveService[];
  }) {
    await this.ensureMember(input.accountId);
    await this.requireProject(input.accountId, input.projectId);
    await ensureProjectRetainer({
      projectId: input.projectId,
      accountId: input.accountId,
    });
    await replaceProjectServiceList(db(this.client), input);
    return this.load(input.accountId, input.projectId, input.clientId);
  }

  async resetServices(input: {
    accountId: string;
    projectId: string;
    clientId?: string | null;
  }) {
    await this.ensureMember(input.accountId);
    await this.requireProject(input.accountId, input.projectId);
    await ensureProjectRetainer({
      projectId: input.projectId,
      accountId: input.accountId,
    });
    await resetProjectServiceList(db(this.client), input);
    return this.load(input.accountId, input.projectId, input.clientId);
  }

  async addCustom(input: {
    accountId: string;
    projectId: string;
    clientId?: string | null;
    name: string;
    description?: string | null;
    creditCost: number;
    requestTypeId?: string | null;
    categoryId?: string | null;
    isVisible?: boolean;
  }) {
    await this.ensureMember(input.accountId);
    await this.requireProject(input.accountId, input.projectId);
    await ensureProjectRetainer({
      projectId: input.projectId,
      accountId: input.accountId,
    });

    const current = await this.load(
      input.accountId,
      input.projectId,
      input.clientId,
    );
    const category = input.categoryId
      ? (current.categories.find((row) => row.id === input.categoryId) ?? null)
      : null;
    const serviceId = await insertScopedRetainerService(db(this.client), {
      accountId: input.accountId,
      scope: 'project',
      projectId: input.projectId,
      clientId: input.clientId,
      name: input.name,
      description: input.description,
      creditCost: input.creditCost,
      requestTypeId: input.requestTypeId,
      categoryId: input.categoryId,
      isVisible: input.isVisible ?? true,
      sortOrder: current.effective.services.length,
    });

    await replaceProjectServiceList(db(this.client), {
      accountId: input.accountId,
      projectId: input.projectId,
      services: [
        ...current.effective.services,
        {
          id: serviceId,
          sourceServiceId: null,
          name: input.name.trim(),
          description: input.description?.trim() || null,
          creditCost: input.creditCost,
          requestTypeId: input.requestTypeId ?? null,
          isActive: true,
          isVisible: input.isVisible ?? true,
          sortOrder: current.effective.services.length,
          scope: 'project',
          categoryId: category?.id ?? null,
          categoryName: category?.name ?? null,
          categorySortOrder: category?.sortOrder ?? UNCATEGORIZED_SORT,
        },
      ],
    });

    return this.load(input.accountId, input.projectId, input.clientId);
  }

  async adjustBalance(input: {
    accountId: string;
    projectId: string;
    delta: number;
    reason?: string;
  }) {
    const { userId } = await this.ensureMember(input.accountId);
    await this.requireProject(input.accountId, input.projectId);
    const result = await adjustProjectRetainerCredits({
      projectId: input.projectId,
      accountId: input.accountId,
      delta: input.delta,
      actorId: userId,
      reason: input.reason ?? 'manual_adjustment',
    });
    if (!result.ok) {
      throw new Error(
        result.error === 'insufficient_balance'
          ? 'Balance cannot go below zero'
          : (result.error ?? 'Could not update balance'),
      );
    }
    return this.load(input.accountId, input.projectId);
  }

  /**
   * Add or remove credits on the client's shared pool (the balance clients see
   * in the portal) — distinct from this project's own credits.
   * The ledger RPCs use the admin client, so membership is checked here.
   * Removals consume FIFO (earliest expiry first) and are recorded with the
   * acting user and no ticket.
   */
  async adjustClientCredits(input: {
    accountId: string;
    projectId: string;
    delta: number;
  }) {
    const { userId, role } = await this.ensureMember(input.accountId);
    // Moves real client spend — owners, admins and staff only.
    if (!RETAINER_EDIT_ROLES.has(role)) throw new Error('Forbidden');
    const project = await this.requireProject(input.accountId, input.projectId);
    if (!project.clientId) {
      throw new Error('This project has no client to adjust credits for');
    }
    const clientOrgId = await this.resolveClientOrgId(
      input.accountId,
      project.clientId,
    );
    if (!clientOrgId) {
      throw new Error('This client has no portal credit account yet');
    }

    if (input.delta > 0) {
      const result = await grantClientCredits({
        clientOrgId,
        accountId: input.accountId,
        amount: input.delta,
        sourceType: 'manual_adjustment',
      });
      if (!result.ok) {
        throw new Error(result.error ?? 'Could not add client credits');
      }
    } else {
      const result = await consumeClientCredits({
        clientOrgId,
        amount: -input.delta,
        actorId: userId,
      });
      if (!result.ok) {
        throw new Error(
          result.error === 'insufficient_balance'
            ? `Client only has ${result.available ?? 0} credits available`
            : (result.error ?? 'Could not remove client credits'),
        );
      }
    }

    return this.load(input.accountId, input.projectId);
  }
}
