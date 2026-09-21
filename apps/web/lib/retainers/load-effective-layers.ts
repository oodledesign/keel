import type {
  CatalogueService,
  EffectiveServiceList,
  ScopedServiceOverride,
} from './effective-services';
import { resolveEffectiveServices } from './effective-services';
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
    sortOrder: Number(row.sort_order ?? 0),
  };
}

function toCatalogue(row: Record<string, unknown>): CatalogueService {
  const mapped = mapRetainerService(row);
  return {
    id: mapped.id,
    name: mapped.name,
    description: mapped.description,
    creditCost: mapped.creditCost,
    requestTypeId: mapped.requestTypeId,
    isActive: mapped.isActive,
    sortOrder: mapped.sortOrder,
    scope: mapped.scope,
    sourceServiceId: mapped.sourceServiceId,
  };
}

export type EffectiveLayers = {
  workspace: CatalogueService[];
  clientCustomized: boolean;
  clientOverrides: ScopedServiceOverride[];
  projectCustomized: boolean;
  projectOverrides: ScopedServiceOverride[];
  clientId: string | null;
  projectId: string | null;
};

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

  const [catalogueRes, clientRes, clientRowsRes, projectRes, projectRowsRes] =
    await Promise.all([
      client
        .from('retainer_services')
        .select('*')
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
            .select(
              'service_id, name, description, credit_cost, request_type_id, is_active, sort_order',
            )
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
            .select(
              'service_id, name, description, credit_cost, request_type_id, is_active, sort_order',
            )
            .eq('project_id', projectId)
        : Promise.resolve({ data: [] as Record<string, unknown>[] }),
    ]);

  const workspace = (
    (catalogueRes.data ?? []) as Array<Record<string, unknown>>
  ).map(toCatalogue);

  const clientCustomized =
    (clientRes.data as { retainer_services_source?: string } | null)
      ?.retainer_services_source === 'custom';
  const projectCustomized =
    (projectRes.data as { services_source?: string } | null)
      ?.services_source === 'custom';

  return {
    workspace,
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
