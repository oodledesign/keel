import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import { requireUser } from '@kit/supabase/require-user';

import { RETAINER_WORKSPACE_ROLES } from '~/lib/retainers/constants';
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
  insertScopedRetainerService,
  replaceClientServiceList,
  resetClientServiceList,
} from '~/lib/retainers/persist-service-list';

export type ClientRetainerServicesBundle = {
  list: EffectiveServiceList;
  library: CatalogueService[];
  categories: ServiceCategory[];
};

function db(client: SupabaseClient) {
  return looseClient(client);
}

export function createClientRetainerServicesService(client: SupabaseClient) {
  return new ClientRetainerServicesService(client);
}

class ClientRetainerServicesService {
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
    return { userId: auth.data.id };
  }

  private async requireClient(accountId: string, clientId: string) {
    const { data, error } = await this.client
      .from('clients')
      .select('id')
      .eq('id', clientId)
      .eq('account_id', accountId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) throw new Error('Client not found or access denied');
  }

  async load(
    accountId: string,
    clientId: string,
  ): Promise<ClientRetainerServicesBundle> {
    await this.ensureMember(accountId);
    await this.requireClient(accountId, clientId);
    const layers = await loadEffectiveLayers(db(this.client), {
      accountId,
      clientId,
    });
    return {
      list: layersToEffectiveList({
        ...layers,
        projectCustomized: false,
        projectOverrides: [],
        projectId: null,
      }),
      library: layers.workspace.filter((row) => row.scope === 'workspace'),
      categories: layers.categories,
    };
  }

  async replaceList(input: {
    accountId: string;
    clientId: string;
    services: EffectiveService[];
  }): Promise<ClientRetainerServicesBundle> {
    await this.ensureMember(input.accountId);
    await this.requireClient(input.accountId, input.clientId);
    await replaceClientServiceList(db(this.client), input);
    return this.load(input.accountId, input.clientId);
  }

  async reset(accountId: string, clientId: string) {
    await this.ensureMember(accountId);
    await this.requireClient(accountId, clientId);
    await resetClientServiceList(db(this.client), { accountId, clientId });
    return this.load(accountId, clientId);
  }

  async addCustom(input: {
    accountId: string;
    clientId: string;
    name: string;
    description?: string | null;
    creditCost: number;
    requestTypeId?: string | null;
    categoryId?: string | null;
    isVisible?: boolean;
  }): Promise<ClientRetainerServicesBundle> {
    await this.ensureMember(input.accountId);
    await this.requireClient(input.accountId, input.clientId);

    const current = await this.load(input.accountId, input.clientId);
    const category = input.categoryId
      ? (current.categories.find((row) => row.id === input.categoryId) ?? null)
      : null;
    const serviceId = await insertScopedRetainerService(db(this.client), {
      accountId: input.accountId,
      scope: 'client',
      clientId: input.clientId,
      name: input.name,
      description: input.description,
      creditCost: input.creditCost,
      requestTypeId: input.requestTypeId,
      categoryId: input.categoryId,
      isVisible: input.isVisible ?? true,
      sortOrder: current.list.services.length,
    });

    await replaceClientServiceList(db(this.client), {
      accountId: input.accountId,
      clientId: input.clientId,
      services: [
        ...current.list.services,
        {
          id: serviceId,
          sourceServiceId: null,
          name: input.name.trim(),
          description: input.description?.trim() || null,
          creditCost: input.creditCost,
          requestTypeId: input.requestTypeId ?? null,
          isActive: true,
          isVisible: input.isVisible ?? true,
          sortOrder: current.list.services.length,
          scope: 'client',
          categoryId: category?.id ?? null,
          categoryName: category?.name ?? null,
          categorySortOrder: category?.sortOrder ?? UNCATEGORIZED_SORT,
        },
      ],
    });

    return this.load(input.accountId, input.clientId);
  }
}
