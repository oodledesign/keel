import 'server-only';

import type { EffectiveService } from './effective-services';
import {
  layersToEffectiveList,
  loadEffectiveLayers,
} from './load-effective-layers';
import type { LooseClient } from './loose-client';

export async function assertCategoryOnAccount(
  client: LooseClient,
  input: { accountId: string; categoryId?: string | null },
) {
  if (!input.categoryId) return;
  const { data, error } = await client
    .from('retainer_service_categories')
    .select('id')
    .eq('id', input.categoryId)
    .eq('account_id', input.accountId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error('Category not found');
}

export function snapshotMembershipRows(services: EffectiveService[]) {
  return services.map((service, index) => ({
    service_id: service.id,
    name: service.name,
    description: service.description,
    credit_cost: service.creditCost,
    request_type_id: service.requestTypeId,
    is_active: service.isActive,
    is_visible: service.isVisible,
    sort_order: service.sortOrder || index,
  }));
}

export async function replaceClientServiceList(
  client: LooseClient,
  input: {
    clientId: string;
    accountId: string;
    services: EffectiveService[];
  },
) {
  const { error: flagError } = await client
    .from('clients')
    .update({ retainer_services_source: 'custom' })
    .eq('id', input.clientId)
    .eq('account_id', input.accountId);
  if (flagError) throw new Error(flagError.message);

  const { error: delError } = await client
    .from('client_retainer_services')
    .delete()
    .eq('client_id', input.clientId);
  if (delError) throw new Error(delError.message);

  const rows = snapshotMembershipRows(input.services);
  if (rows.length > 0) {
    const { error: insError } = await client
      .from('client_retainer_services')
      .insert(
        rows.map((row) => ({
          ...row,
          client_id: input.clientId,
        })),
      );
    if (insError) throw new Error(insError.message);
  }
}

export async function resetClientServiceList(
  client: LooseClient,
  input: { clientId: string; accountId: string },
) {
  const { error: flagError } = await client
    .from('clients')
    .update({ retainer_services_source: 'inherited' })
    .eq('id', input.clientId)
    .eq('account_id', input.accountId);
  if (flagError) throw new Error(flagError.message);

  const { error: delError } = await client
    .from('client_retainer_services')
    .delete()
    .eq('client_id', input.clientId);
  if (delError) throw new Error(delError.message);
}

export async function replaceProjectServiceList(
  client: LooseClient,
  input: {
    projectId: string;
    accountId: string;
    services: EffectiveService[];
  },
) {
  const { error: flagError } = await client
    .from('project_retainers')
    .update({ services_source: 'custom' })
    .eq('project_id', input.projectId)
    .eq('account_id', input.accountId);
  if (flagError) throw new Error(flagError.message);

  const { error: delError } = await client
    .from('project_retainer_services')
    .delete()
    .eq('project_id', input.projectId);
  if (delError) throw new Error(delError.message);

  const rows = snapshotMembershipRows(input.services);
  if (rows.length > 0) {
    const { error: insError } = await client
      .from('project_retainer_services')
      .insert(
        rows.map((row) => ({
          ...row,
          project_id: input.projectId,
        })),
      );
    if (insError) throw new Error(insError.message);
  }
}

export async function resetProjectServiceList(
  client: LooseClient,
  input: { projectId: string; accountId: string },
) {
  const { error: flagError } = await client
    .from('project_retainers')
    .update({ services_source: 'inherited' })
    .eq('project_id', input.projectId)
    .eq('account_id', input.accountId);
  if (flagError) throw new Error(flagError.message);

  const { error: delError } = await client
    .from('project_retainer_services')
    .delete()
    .eq('project_id', input.projectId);
  if (delError) throw new Error(delError.message);
}

export async function insertScopedRetainerService(
  client: LooseClient,
  input: {
    accountId: string;
    scope: 'client' | 'project';
    clientId?: string | null;
    projectId?: string | null;
    name: string;
    description?: string | null;
    creditCost: number;
    requestTypeId?: string | null;
    categoryId?: string | null;
    isVisible?: boolean;
    sortOrder?: number;
  },
): Promise<string> {
  await assertCategoryOnAccount(client, {
    accountId: input.accountId,
    categoryId: input.categoryId,
  });
  const { data, error } = await client
    .from('retainer_services')
    .insert({
      account_id: input.accountId,
      scope: input.scope,
      client_id: input.scope === 'client' ? (input.clientId ?? null) : null,
      project_id: input.scope === 'project' ? (input.projectId ?? null) : null,
      name: input.name.trim(),
      description: input.description?.trim() || null,
      credit_cost: input.creditCost,
      request_type_id: input.requestTypeId ?? null,
      category_id: input.categoryId ?? null,
      is_active: true,
      is_visible: input.isVisible ?? true,
      sort_order: input.sortOrder ?? 0,
    })
    .select('id')
    .single();

  if (error || !data?.id) {
    throw new Error(error?.message ?? 'Could not create custom service');
  }

  return String(data.id);
}

export async function addServiceToProjectEffectiveList(
  client: LooseClient,
  input: {
    accountId: string;
    projectId: string;
    clientId?: string | null;
    serviceId: string;
  },
) {
  const layers = await loadEffectiveLayers(client, input);
  const effective = layersToEffectiveList(layers);
  const catalogue =
    layers.workspace.find((row) => row.id === input.serviceId) ?? null;
  if (!catalogue) {
    throw new Error('Service not found');
  }

  const added: EffectiveService = {
    id: catalogue.id,
    sourceServiceId: catalogue.sourceServiceId,
    name: catalogue.name,
    description: catalogue.description,
    creditCost: catalogue.creditCost,
    requestTypeId: catalogue.requestTypeId,
    isActive: true,
    isVisible: catalogue.isVisible,
    sortOrder: effective.services.length,
    scope: catalogue.scope,
    categoryId: catalogue.categoryId,
    categoryName: catalogue.categoryName,
    categorySortOrder: catalogue.categorySortOrder,
  };

  // Inherited workspace default: keep the existing allowlist behaviour
  // (this service only). Client/project lists snapshot then append.
  const next =
    effective.source === 'workspace'
      ? [{ ...added, sortOrder: 0 }]
      : effective.services.some((row) => row.id === input.serviceId)
        ? effective.services
        : [...effective.services, added];

  if (effective.source !== 'workspace' && next === effective.services) {
    return;
  }

  await replaceProjectServiceList(client, {
    accountId: input.accountId,
    projectId: input.projectId,
    services: next,
  });
}
