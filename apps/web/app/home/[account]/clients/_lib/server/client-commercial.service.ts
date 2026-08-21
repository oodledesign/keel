import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

export type ClientCommercialDisposalRow = {
  id: string;
  name: string;
  status: string;
  updatedAt: string;
  relation: 'instructing' | 'party';
};

export type ClientCommercialRequirementRow = {
  id: string;
  title: string;
  stage: string;
  updatedAt: string;
  meta: string | null;
};

export type ClientCommercialViewingRow = {
  id: string;
  status: string;
  scheduledAt: string | null;
  listingId: string | null;
  listingName: string | null;
};

export type ClientCommercialLeaseRow = {
  id: string;
  status: string;
  updatedAt: string;
  listingId: string | null;
  listingName: string | null;
  propertyLabel: string | null;
};

export type ClientCommercialSaleRow = {
  id: string;
  kind: 'disposal' | 'lease';
  title: string;
  status: string;
  updatedAt: string;
  hrefKind: 'listing' | 'lease';
};

export type ClientCommercialPropertyRow = {
  id: string;
  name: string;
  role: string;
  postcode: string | null;
  town: string | null;
  displayPhone: string | null;
  updatedAt: string;
};

const SALE_DISPOSAL_STATUSES = new Set(['sold', 'let']);

export function createClientCommercialService(client: SupabaseClient) {
  return new ClientCommercialService(client);
}

class ClientCommercialService {
  constructor(private readonly client: SupabaseClient) {}

  async listDisposals(input: {
    accountId: string;
    clientId: string;
  }): Promise<ClientCommercialDisposalRow[]> {
    const [
      { data: instructing, error: instructingError },
      { data: parties, error: partiesError },
    ] = await Promise.all([
      this.client
        .from('commercial_listings')
        .select('id, name, status, updated_at')
        .eq('account_id', input.accountId)
        .eq('instructing_client_id', input.clientId)
        .order('updated_at', { ascending: false }),
      this.client
        .from('commercial_listing_parties')
        .select(
          'listing_id, commercial_listings!inner(id, name, status, updated_at, account_id)',
        )
        .eq('account_id', input.accountId)
        .eq('client_id', input.clientId)
        .eq('commercial_listings.account_id', input.accountId),
    ]);

    if (instructingError) throw instructingError;
    if (partiesError) throw partiesError;

    const byId = new Map<string, ClientCommercialDisposalRow>();

    for (const row of instructing ?? []) {
      byId.set(row.id as string, {
        id: row.id as string,
        name: (row.name as string) || 'Untitled disposal',
        status: (row.status as string) ?? 'draft',
        updatedAt: row.updated_at as string,
        relation: 'instructing',
      });
    }

    for (const row of parties ?? []) {
      const listing = row.commercial_listings as unknown as {
        id: string;
        name: string | null;
        status: string | null;
        updated_at: string;
      } | null;
      if (!listing?.id) continue;
      if (byId.has(listing.id)) continue;
      byId.set(listing.id, {
        id: listing.id,
        name: listing.name || 'Untitled disposal',
        status: listing.status ?? 'draft',
        updatedAt: listing.updated_at,
        relation: 'party',
      });
    }

    return [...byId.values()].sort((a, b) =>
      b.updatedAt.localeCompare(a.updatedAt),
    );
  }

  async listRequirements(input: {
    accountId: string;
    clientId: string;
  }): Promise<ClientCommercialRequirementRow[]> {
    const { data, error } = await this.client
      .from('commercial_requirements')
      .select('id, company_name, contact_name, stage, updated_at')
      .eq('account_id', input.accountId)
      .eq('client_id', input.clientId)
      .order('updated_at', { ascending: false });

    if (error) throw error;

    return (data ?? []).map((row) => {
      const company = (row.company_name as string | null)?.trim() || null;
      const contact = (row.contact_name as string | null)?.trim() || null;
      return {
        id: row.id as string,
        title: company || contact || 'Untitled requirement',
        stage: (row.stage as string) ?? 'new',
        updatedAt: row.updated_at as string,
        meta: company && contact && company !== contact ? contact : null,
      };
    });
  }

  async listViewings(input: {
    accountId: string;
    clientId: string;
  }): Promise<ClientCommercialViewingRow[]> {
    const { data, error } = await this.client
      .from('commercial_viewings')
      .select('id, status, scheduled_at, listing_id, commercial_listings(name)')
      .eq('account_id', input.accountId)
      .eq('client_id', input.clientId)
      .order('scheduled_at', { ascending: false, nullsFirst: false });

    if (error) throw error;

    return (data ?? []).map((row) => {
      const listing = row.commercial_listings as unknown as {
        name: string | null;
      } | null;
      return {
        id: row.id as string,
        status: (row.status as string) ?? 'scheduled',
        scheduledAt: (row.scheduled_at as string | null) ?? null,
        listingId: (row.listing_id as string | null) ?? null,
        listingName: listing?.name ?? null,
      };
    });
  }

  async listLeases(input: {
    accountId: string;
    clientId: string;
  }): Promise<ClientCommercialLeaseRow[]> {
    const { data, error } = await this.client
      .from('commercial_leases')
      .select(
        'id, status, updated_at, listing_id, property_label, commercial_listings(name)',
      )
      .eq('account_id', input.accountId)
      .eq('client_id', input.clientId)
      .order('updated_at', { ascending: false });

    if (error) throw error;

    return (data ?? []).map((row) => {
      const listing = row.commercial_listings as unknown as {
        name: string | null;
      } | null;
      return {
        id: row.id as string,
        status: (row.status as string) ?? 'active',
        updatedAt: row.updated_at as string,
        listingId: (row.listing_id as string | null) ?? null,
        listingName: listing?.name ?? null,
        propertyLabel: (row.property_label as string | null) ?? null,
      };
    });
  }

  async listSales(input: {
    accountId: string;
    clientId: string;
  }): Promise<ClientCommercialSaleRow[]> {
    const [disposals, leases] = await Promise.all([
      this.listDisposals(input),
      this.listLeases(input),
    ]);

    const sales: ClientCommercialSaleRow[] = [];

    for (const disposal of disposals) {
      if (!SALE_DISPOSAL_STATUSES.has(disposal.status)) continue;
      sales.push({
        id: disposal.id,
        kind: 'disposal',
        title: disposal.name,
        status: disposal.status,
        updatedAt: disposal.updatedAt,
        hrefKind: 'listing',
      });
    }

    for (const lease of leases) {
      sales.push({
        id: lease.id,
        kind: 'lease',
        title: lease.propertyLabel || lease.listingName || 'Untitled lease',
        status: lease.status,
        updatedAt: lease.updatedAt,
        hrefKind: 'lease',
      });
    }

    return sales.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  async listProperties(input: {
    accountId: string;
    clientId: string;
  }): Promise<ClientCommercialPropertyRow[]> {
    const { data, error } = await (
      this.client as unknown as { from: (t: string) => any }
    )
      .from('commercial_property_parties')
      .select(
        'role, contact_phone, commercial_properties!inner(id, name, postcode, town, updated_at, account_id, archived_at)',
      )
      .eq('account_id', input.accountId)
      .eq('client_id', input.clientId)
      .eq('commercial_properties.account_id', input.accountId)
      .is('commercial_properties.archived_at', null);

    if (error) throw error;

    const byId = new Map<string, ClientCommercialPropertyRow>();
    for (const row of data ?? []) {
      const property = row.commercial_properties as unknown as {
        id: string;
        name: string | null;
        postcode: string | null;
        town: string | null;
        updated_at: string;
      } | null;
      if (!property?.id) continue;
      const existing = byId.get(property.id);
      if (existing) continue;
      byId.set(property.id, {
        id: property.id,
        name: property.name || 'Untitled property',
        role: (row.role as string) ?? 'other',
        postcode: property.postcode,
        town: property.town,
        displayPhone: (row.contact_phone as string | null) ?? null,
        updatedAt: property.updated_at,
      });
    }

    return [...byId.values()].sort((a, b) =>
      b.updatedAt.localeCompare(a.updatedAt),
    );
  }
}
