import 'server-only';

import type {
  CatalogueService,
  EffectiveServiceList,
  ScopedServiceOverride,
  ServiceCategory,
} from './effective-services';
import {
  UNCATEGORIZED_SORT,
  resolveEffectiveServices,
} from './effective-services';
import type { LooseClient } from './loose-client';
import { mapRetainerService } from './map-records';

function mapOverride(row: Record<string, unknown>): ScopedServiceOverride {
  return {
    serviceId: String(row.service_id),
    name: row.name == null ? null : String(row.name),
    description: row.description == null ? null : String(row.description),
    creditCost:
      row.credit_cost == null || row.credit_cost === ''
        ? null
        : Number(row.credit_cost),
    requestTypeId:
      row.request_type_id == null ? null : String(row.request_type_id),
    isActive: row.is_active == null ? true : Boolean(row.is_active),
    isVisible: row.is_visible == null ? true : Boolean(row.is_visible),
    sortOrder: Number(row.sort_order ?? 0),
  };
}

function mapCategory(row: Record<string, unknown>): ServiceCategory {
  return {
    id: String(row.id),
    name: String(row.name ?? '').trim() || 'Untitled',
    sortOrder: Number(row.sort_order ?? 0),
  };
}

function toCatalogue(
  row: Record<string, unknown>,
  categories: Map<string, ServiceCategory>,
): CatalogueService {
  const mapped = mapRetainerService(row);
  const category = mapped.categoryId
    ? (categories.get(mapped.categoryId) ?? null)
    : null;
  return {
    id: mapped.id,
    name: mapped.name,
    description: mapped.description,
    creditCost: mapped.creditCost,
    requestTypeId: mapped.requestTypeId,
    isActive: mapped.isActive,
    isVisible: mapped.isVisible,
    sortOrder: mapped.sortOrder,
    scope: mapped.scope,
    sourceServiceId: mapped.sourceServiceId,
    clientId: mapped.clientId,
    projectId: mapped.projectId,
    categoryId: category?.id ?? mapped.categoryId,
    categoryName: category?.name ?? null,
    categorySortOrder: category?.sortOrder ?? UNCATEGORIZED_SORT,
  };
}

export type EffectiveLayers = {
  workspace: CatalogueService[];
  categories: ServiceCategory[];
  clientCustomized: boolean;
  clientOverrides: ScopedServiceOverride[];
  projectCustomized: boolean;
  projectOverrides: ScopedServiceOverride[];
  clientId: string | null;
  projectId: string | null;
};

const OVERRIDE_COLUMNS =
  'service_id, name, description, credit_cost, request_type_id, is_active, is_visible, sort_order';

export async function loadEffectiveLayers(
  client: LooseClient,
  input: {
    accountId: string;
    clientId?: string | null;
    projectId?: string | null;
  },
): Promise<EffectiveLayers> {
  let clientId = input.clientId ?? null;
  const projectId = input.projectId ?? null;

  if (!clientId && projectId) {
    const { data: project } = await client
      .from('projects')
      .select('client_id')
      .eq('id', projectId)
      .maybeSingle();
    clientId = project?.client_id ? String(project.client_id) : null;
  }

  const [
    catalogueRes,
    categoryRes,
    clientRes,
    clientRowsRes,
    projectRes,
    projectRowsRes,
  ] = await Promise.all([
    client
      .from('retainer_services')
      .select('*')
      .eq('account_id', input.accountId)
      .order('sort_order', { ascending: true })
      .order('name', { ascending: true }),
    client
      .from('retainer_service_categories')
      .select('id, name, sort_order')
      .eq('account_id', input.accountId)
      .order('sort_order', { ascending: true })
      .order('name', { ascending: true }),
    clientId
      ? client
          .from('clients')
          .select('retainer_services_source')
          .eq('id', clientId)
          .eq('account_id', input.accountId)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    clientId
      ? client
          .from('client_retainer_services')
          .select(OVERRIDE_COLUMNS)
          .eq('client_id', clientId)
      : Promise.resolve({ data: [] as Record<string, unknown>[] }),
    projectId
      ? client
          .from('project_retainers')
          .select('services_source')
          .eq('project_id', projectId)
          .eq('account_id', input.accountId)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    projectId
      ? client
          .from('project_retainer_services')
          .select(OVERRIDE_COLUMNS)
          .eq('project_id', projectId)
      : Promise.resolve({ data: [] as Record<string, unknown>[] }),
  ]);

  const categories = (
    (categoryRes.data ?? []) as Array<Record<string, unknown>>
  ).map(mapCategory);
  const categoryById = new Map(categories.map((row) => [row.id, row]));

  const workspace = (
    (catalogueRes.data ?? []) as Array<Record<string, unknown>>
  ).map((row) => toCatalogue(row, categoryById));

  const clientCustomized =
    (clientRes.data as { retainer_services_source?: string } | null)
      ?.retainer_services_source === 'custom';
  const projectCustomized =
    (projectRes.data as { services_source?: string } | null)
      ?.services_source === 'custom';

  return {
    workspace,
    categories,
    clientCustomized,
    clientOverrides: (
      (clientRowsRes.data ?? []) as Array<Record<string, unknown>>
    ).map(mapOverride),
    projectCustomized,
    projectOverrides: (
      (projectRowsRes.data ?? []) as Array<Record<string, unknown>>
    ).map(mapOverride),
    clientId,
    projectId,
  };
}

export function layersToEffectiveList(
  layers: EffectiveLayers,
): EffectiveServiceList {
  return resolveEffectiveServices(layers);
}
