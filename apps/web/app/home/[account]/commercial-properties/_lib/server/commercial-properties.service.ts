import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import type { PropertyPartyRole } from '~/lib/commercial/commercial-constants';

import type {
  AddCommercialPropertyPartyInput,
  CreateCommercialPropertyInput,
  UpdateCommercialPropertyInput,
} from '../schema/commercial-properties.schema';

/** Tables not yet in generated Database types — unwrap until typegen. */
function fromTable(client: SupabaseClient, table: string) {
  return (client as unknown as { from: (t: string) => any }).from(table);
}

function num(value: unknown): number | null {
  if (value == null || value === '') return null;
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

export type CommercialProperty = {
  id: string;
  accountId: string;
  name: string;
  addressLine1: string | null;
  addressLine2: string | null;
  town: string | null;
  postcode: string | null;
  country: string | null;
  latitude: number | null;
  longitude: number | null;
  sector: string | null;
  notes: string | null;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
  partySummary?: string | null;
  disposalCount?: number;
};

export type CommercialPropertyParty = {
  id: string;
  propertyId: string;
  clientId: string;
  contactId: string | null;
  role: PropertyPartyRole;
  clientName: string;
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  displayPhone: string | null;
  sortOrder: number;
};

export type CommercialPropertyOption = {
  id: string;
  name: string;
  postcode: string | null;
  town: string | null;
};

export type PropertyPartyClientOption = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  commercialRole: string | null;
  contactId?: string | null;
  contactName?: string | null;
  subtitle?: string | null;
};

function mapProperty(row: Record<string, unknown>): CommercialProperty {
  return {
    id: row.id as string,
    accountId: row.account_id as string,
    name: (row.name as string) || 'Untitled property',
    addressLine1: (row.address_line_1 as string | null) ?? null,
    addressLine2: (row.address_line_2 as string | null) ?? null,
    town: (row.town as string | null) ?? null,
    postcode: (row.postcode as string | null) ?? null,
    country: (row.country as string | null) ?? null,
    latitude: num(row.latitude),
    longitude: num(row.longitude),
    sector: (row.sector as string | null) ?? null,
    notes: (row.notes as string | null) ?? null,
    archivedAt: (row.archived_at as string | null) ?? null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

function clientDisplayName(clientRow: Record<string, unknown> | null): string {
  if (!clientRow) return 'Contact';
  return (
    (clientRow.display_name as string | null)?.trim() ||
    (clientRow.company_name as string | null)?.trim() ||
    [clientRow.first_name, clientRow.last_name]
      .filter(Boolean)
      .join(' ')
      .trim() ||
    'Contact'
  );
}

async function resolvePrimaryContactPhone(
  client: SupabaseClient,
  accountId: string,
  clientId: string,
): Promise<string | null> {
  const { data } = await client
    .from('client_contacts')
    .select('is_primary, contacts(phone)')
    .eq('client_id', clientId)
    .order('is_primary', { ascending: false })
    .limit(5);

  for (const row of data ?? []) {
    const contact = row.contacts as unknown as { phone?: string | null } | null;
    const phone = contact?.phone?.trim();
    if (phone) return phone;
  }

  const { data: clientRow } = await client
    .from('clients')
    .select('phone')
    .eq('id', clientId)
    .eq('account_id', accountId)
    .maybeSingle();

  return (clientRow?.phone as string | null)?.trim() || null;
}

export function createCommercialPropertiesService(client: SupabaseClient) {
  return new CommercialPropertiesService(client);
}

class CommercialPropertiesService {
  constructor(private readonly client: SupabaseClient) {}

  async listProperties(input: {
    accountId: string;
    query?: string;
    includeArchived?: boolean;
  }): Promise<CommercialProperty[]> {
    let query = fromTable(this.client, 'commercial_properties')
      .select('*')
      .eq('account_id', input.accountId)
      .order('updated_at', { ascending: false })
      .limit(200);

    if (!input.includeArchived) {
      query = query.is('archived_at', null);
    }

    const q = input.query?.trim().replace(/[%_,]/g, ' ');
    if (q) {
      query = query.or(
        `name.ilike.%${q}%,address_line_1.ilike.%${q}%,town.ilike.%${q}%,postcode.ilike.%${q}%`,
      );
    }

    const { data, error } = await query;
    if (error) throw new Error(error.message);

    const properties = ((data ?? []) as Array<Record<string, unknown>>).map(
      mapProperty,
    );

    if (properties.length === 0) return properties;

    const ids = properties.map((p) => p.id);
    const [{ data: partyRows }, { data: listingRows }] = await Promise.all([
      fromTable(this.client, 'commercial_property_parties')
        .select(
          'property_id, role, clients(display_name, company_name, first_name, last_name)',
        )
        .eq('account_id', input.accountId)
        .in('property_id', ids),
      fromTable(this.client, 'commercial_listings')
        .select('id, commercial_property_id')
        .eq('account_id', input.accountId)
        .in('commercial_property_id', ids),
    ]);

    const summaryByProperty = new Map<string, string[]>();
    for (const row of (partyRows ?? []) as Array<Record<string, unknown>>) {
      const propertyId = row.property_id as string;
      const name = clientDisplayName(
        row.clients as Record<string, unknown> | null,
      );
      const list = summaryByProperty.get(propertyId) ?? [];
      if (list.length < 2) list.push(name);
      summaryByProperty.set(propertyId, list);
    }

    const disposalCount = new Map<string, number>();
    for (const row of (listingRows ?? []) as Array<Record<string, unknown>>) {
      const propertyId = row.commercial_property_id as string;
      disposalCount.set(propertyId, (disposalCount.get(propertyId) ?? 0) + 1);
    }

    return properties.map((property) => ({
      ...property,
      partySummary:
        (summaryByProperty.get(property.id) ?? []).join(', ') || null,
      disposalCount: disposalCount.get(property.id) ?? 0,
    }));
  }

  async getProperty(
    propertyId: string,
    accountId: string,
  ): Promise<CommercialProperty | null> {
    const { data, error } = await fromTable(
      this.client,
      'commercial_properties',
    )
      .select('*')
      .eq('id', propertyId)
      .eq('account_id', accountId)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!data) return null;
    return mapProperty(data as Record<string, unknown>);
  }

  async createProperty(
    input: CreateCommercialPropertyInput & { createdBy?: string | null },
  ): Promise<CommercialProperty> {
    const { data, error } = await fromTable(
      this.client,
      'commercial_properties',
    )
      .insert({
        account_id: input.accountId,
        name: input.name.trim(),
        address_line_1: input.addressLine1?.trim() || null,
        address_line_2: input.addressLine2?.trim() || null,
        town: input.town?.trim() || null,
        postcode: input.postcode?.trim() || null,
        country: input.country?.trim() || 'GB',
        sector: input.sector?.trim() || null,
        notes: input.notes?.trim() || null,
        latitude: input.latitude ?? null,
        longitude: input.longitude ?? null,
        created_by: input.createdBy ?? null,
      })
      .select('*')
      .single();

    if (error || !data) {
      throw new Error(error?.message ?? 'Failed to create property');
    }

    return mapProperty(data as Record<string, unknown>);
  }

  async updateProperty(
    input: UpdateCommercialPropertyInput,
  ): Promise<CommercialProperty> {
    const patch: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (input.name !== undefined) patch.name = input.name.trim();
    if (input.addressLine1 !== undefined) {
      patch.address_line_1 = input.addressLine1?.trim() || null;
    }
    if (input.addressLine2 !== undefined) {
      patch.address_line_2 = input.addressLine2?.trim() || null;
    }
    if (input.town !== undefined) patch.town = input.town?.trim() || null;
    if (input.postcode !== undefined) {
      patch.postcode = input.postcode?.trim() || null;
    }
    if (input.country !== undefined)
      patch.country = input.country?.trim() || 'GB';
    if (input.sector !== undefined) patch.sector = input.sector?.trim() || null;
    if (input.notes !== undefined) patch.notes = input.notes?.trim() || null;
    if (input.latitude !== undefined) patch.latitude = input.latitude;
    if (input.longitude !== undefined) patch.longitude = input.longitude;
    if (input.archived === true) patch.archived_at = new Date().toISOString();
    if (input.archived === false) patch.archived_at = null;

    const { data, error } = await fromTable(
      this.client,
      'commercial_properties',
    )
      .update(patch)
      .eq('id', input.propertyId)
      .eq('account_id', input.accountId)
      .select('*')
      .single();

    if (error || !data) {
      throw new Error(error?.message ?? 'Failed to update property');
    }

    return mapProperty(data as Record<string, unknown>);
  }

  async listParties(
    propertyId: string,
    accountId: string,
  ): Promise<CommercialPropertyParty[]> {
    const { data: rows, error } = await fromTable(
      this.client,
      'commercial_property_parties',
    )
      .select(
        'id, property_id, client_id, contact_id, role, contact_name, contact_email, contact_phone, sort_order, clients(display_name, company_name, first_name, last_name, phone, email), contacts(full_name, first_name, last_name, phone, email)',
      )
      .eq('property_id', propertyId)
      .eq('account_id', accountId)
      .order('sort_order', { ascending: true });

    if (error) {
      console.error('[commercial-properties] listParties:', error.message);
      return [];
    }

    return Promise.all(
      ((rows ?? []) as Array<Record<string, unknown>>).map(
        async (row, index) => {
          const clientRow = row.clients as Record<string, unknown> | null;
          const contactRow = row.contacts as Record<string, unknown> | null;
          const contactName =
            (row.contact_name as string | null)?.trim() ||
            (contactRow?.full_name as string | null)?.trim() ||
            [contactRow?.first_name, contactRow?.last_name]
              .filter(Boolean)
              .join(' ')
              .trim() ||
            null;
          const contactPhone =
            (row.contact_phone as string | null)?.trim() ||
            (contactRow?.phone as string | null)?.trim() ||
            null;
          const contactEmail =
            (row.contact_email as string | null)?.trim() ||
            (contactRow?.email as string | null)?.trim() ||
            null;

          let displayPhone = contactPhone;
          if (!displayPhone) {
            displayPhone =
              (clientRow?.phone as string | null)?.trim() ||
              (await resolvePrimaryContactPhone(
                this.client,
                accountId,
                row.client_id as string,
              ));
          }

          return {
            id: row.id as string,
            propertyId: row.property_id as string,
            clientId: row.client_id as string,
            contactId: (row.contact_id as string | null) ?? null,
            role: row.role as PropertyPartyRole,
            clientName: clientDisplayName(clientRow),
            contactName,
            contactEmail:
              contactEmail || ((clientRow?.email as string | null) ?? null),
            contactPhone,
            displayPhone,
            sortOrder: Number(row.sort_order ?? index),
          };
        },
      ),
    );
  }

  async searchPartyClients(input: {
    accountId: string;
    query?: string;
    excludePropertyId?: string;
    role?: PropertyPartyRole;
  }): Promise<PropertyPartyClientOption[]> {
    let excludeIds: string[] = [];
    if (input.excludePropertyId) {
      let linkedQuery = fromTable(this.client, 'commercial_property_parties')
        .select('client_id')
        .eq('property_id', input.excludePropertyId)
        .eq('account_id', input.accountId);
      if (input.role) linkedQuery = linkedQuery.eq('role', input.role);
      const { data: linked } = await linkedQuery;
      excludeIds = ((linked ?? []) as Array<{ client_id: string }>).map(
        (r) => r.client_id,
      );
    }

    const q = input.query?.trim().replace(/[%_,]/g, ' ');
    const clientResults: PropertyPartyClientOption[] = [];

    let clientsQuery = this.client
      .from('clients')
      .select(
        'id, display_name, company_name, first_name, last_name, email, phone, commercial_role',
      )
      .eq('account_id', input.accountId)
      .is('deleted_at', null)
      .order('display_name', { ascending: true })
      .limit(30);

    if (q) {
      clientsQuery = clientsQuery.or(
        `display_name.ilike.%${q}%,company_name.ilike.%${q}%,email.ilike.%${q}%,first_name.ilike.%${q}%,last_name.ilike.%${q}%,phone.ilike.%${q}%`,
      );
    }

    const { data: clients, error } = await clientsQuery;
    if (error) throw new Error(error.message);

    for (const row of (clients ?? []) as Array<Record<string, unknown>>) {
      if (excludeIds.includes(row.id as string)) continue;
      const name =
        (row.display_name as string | null)?.trim() ||
        (row.company_name as string | null)?.trim() ||
        [row.first_name, row.last_name].filter(Boolean).join(' ').trim() ||
        'Contact';
      clientResults.push({
        id: row.id as string,
        name,
        email: (row.email as string | null) ?? null,
        phone: (row.phone as string | null) ?? null,
        commercialRole: (row.commercial_role as string | null) ?? null,
      });
    }

    if (q && q.length >= 2) {
      const { data: people } = await this.client
        .from('contacts')
        .select(
          'id, full_name, first_name, last_name, email, phone, client_contacts!inner(client_id, clients!inner(id, display_name, company_name, account_id))',
        )
        .eq('account_id', input.accountId)
        .or(
          `full_name.ilike.%${q}%,first_name.ilike.%${q}%,last_name.ilike.%${q}%,email.ilike.%${q}%,phone.ilike.%${q}%`,
        )
        .limit(20);

      for (const person of (people ?? []) as Array<Record<string, unknown>>) {
        const links = person.client_contacts as unknown as Array<{
          client_id: string;
          clients:
            | {
                id: string;
                display_name: string | null;
                company_name: string | null;
                account_id: string;
              }
            | Array<{
                id: string;
                display_name: string | null;
                company_name: string | null;
                account_id: string;
              }>;
        }>;

        for (const link of links ?? []) {
          const company = Array.isArray(link.clients)
            ? link.clients[0]
            : link.clients;
          if (!company || company.account_id !== input.accountId) continue;
          if (excludeIds.includes(company.id)) continue;

          const personName =
            (person.full_name as string | null)?.trim() ||
            [person.first_name, person.last_name]
              .filter(Boolean)
              .join(' ')
              .trim() ||
            'Person';
          const companyName =
            company.display_name?.trim() ||
            company.company_name?.trim() ||
            'Company';

          clientResults.push({
            id: company.id,
            name: `${personName} @ ${companyName}`,
            email: (person.email as string | null) ?? null,
            phone: (person.phone as string | null) ?? null,
            commercialRole: null,
            contactId: person.id as string,
            contactName: personName,
            subtitle: companyName,
          });
        }
      }
    }

    const seen = new Set<string>();
    return clientResults
      .filter((row) => {
        const key = `${row.id}:${row.contactId ?? ''}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .slice(0, 20);
  }

  async addParty(
    input: AddCommercialPropertyPartyInput,
  ): Promise<CommercialPropertyParty[]> {
    const property = await this.getProperty(input.propertyId, input.accountId);
    if (!property) throw new Error('Property not found');

    let clientId = input.clientId ?? null;
    const contactName = input.contactName?.trim() || null;
    const contactEmail =
      typeof input.contactEmail === 'string'
        ? input.contactEmail.trim() || null
        : null;
    const contactPhone = input.contactPhone?.trim() || null;

    if (!clientId) {
      const companyName = input.companyName?.trim();
      if (!companyName) throw new Error('Company name is required');

      const { data: created, error: createError } = await this.client
        .from('clients')
        .insert({
          account_id: input.accountId,
          client_type: 'business',
          company_name: companyName,
          display_name: companyName,
          email: contactEmail,
          phone: contactPhone,
          commercial_role:
            input.role === 'landlord' || input.role === 'tenant'
              ? input.role
              : 'other',
        })
        .select('id')
        .single();

      if (createError || !created) {
        throw new Error(createError?.message ?? 'Failed to create contact');
      }
      clientId = created.id as string;
    }

    const { count } = await fromTable(
      this.client,
      'commercial_property_parties',
    )
      .select('id', { count: 'exact', head: true })
      .eq('property_id', input.propertyId)
      .eq('account_id', input.accountId);

    const { error: insertError } = await fromTable(
      this.client,
      'commercial_property_parties',
    ).insert({
      property_id: input.propertyId,
      account_id: input.accountId,
      client_id: clientId,
      contact_id: input.contactId ?? null,
      role: input.role,
      contact_name: contactName,
      contact_email: contactEmail,
      contact_phone: contactPhone,
      sort_order: count ?? 0,
    });

    if (insertError) {
      if (insertError.code === '23505') {
        throw new Error('That contact is already linked with this role');
      }
      throw new Error(insertError.message);
    }

    return this.listParties(input.propertyId, input.accountId);
  }

  async removeParty(input: {
    accountId: string;
    propertyId: string;
    partyId: string;
  }): Promise<CommercialPropertyParty[]> {
    const { error } = await fromTable(
      this.client,
      'commercial_property_parties',
    )
      .delete()
      .eq('id', input.partyId)
      .eq('property_id', input.propertyId)
      .eq('account_id', input.accountId);

    if (error) throw new Error(error.message);
    return this.listParties(input.propertyId, input.accountId);
  }

  async listLinkedListings(
    propertyId: string,
    accountId: string,
  ): Promise<Array<{ id: string; name: string; status: string }>> {
    const { data, error } = await fromTable(this.client, 'commercial_listings')
      .select('id, name, status')
      .eq('account_id', accountId)
      .eq('commercial_property_id', propertyId)
      .order('updated_at', { ascending: false });

    if (error) throw new Error(error.message);
    return ((data ?? []) as Array<Record<string, unknown>>).map((row) => ({
      id: row.id as string,
      name: (row.name as string) || 'Untitled disposal',
      status: (row.status as string) ?? 'draft',
    }));
  }

  async searchProperties(input: {
    accountId: string;
    query?: string;
  }): Promise<CommercialPropertyOption[]> {
    let query = fromTable(this.client, 'commercial_properties')
      .select('id, name, postcode, town')
      .eq('account_id', input.accountId)
      .is('archived_at', null)
      .order('name', { ascending: true })
      .limit(40);

    const q = input.query?.trim().replace(/[%_,]/g, ' ');
    if (q) {
      query = query.or(
        `name.ilike.%${q}%,address_line_1.ilike.%${q}%,postcode.ilike.%${q}%,town.ilike.%${q}%`,
      );
    }

    const { data, error } = await query;
    if (error) throw new Error(error.message);

    return ((data ?? []) as Array<Record<string, unknown>>).map((row) => ({
      id: row.id as string,
      name: (row.name as string) || 'Untitled property',
      postcode: (row.postcode as string | null) ?? null,
      town: (row.town as string | null) ?? null,
    }));
  }

  async linkListingToProperty(input: {
    accountId: string;
    listingId: string;
    propertyId: string | null;
  }): Promise<void> {
    if (input.propertyId) {
      const property = await this.getProperty(
        input.propertyId,
        input.accountId,
      );
      if (!property) throw new Error('Property not found');
    }

    const { error } = await fromTable(this.client, 'commercial_listings')
      .update({
        commercial_property_id: input.propertyId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', input.listingId)
      .eq('account_id', input.accountId);

    if (error) throw new Error(error.message);
  }

  async createPropertyFromListing(input: {
    accountId: string;
    listingId: string;
    createdBy?: string | null;
  }): Promise<CommercialProperty> {
    const { data: listing, error } = await fromTable(
      this.client,
      'commercial_listings',
    )
      .select(
        'id, name, address_line_1, address_line_2, town, postcode, country, sector, latitude, longitude, commercial_property_id, instructing_client_id',
      )
      .eq('id', input.listingId)
      .eq('account_id', input.accountId)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!listing) throw new Error('Listing not found');

    const existingId = listing.commercial_property_id as string | null;
    if (existingId) {
      const existing = await this.getProperty(existingId, input.accountId);
      if (existing) return existing;
    }

    const property = await this.createProperty({
      accountId: input.accountId,
      name: (listing.name as string) || 'Property',
      addressLine1: (listing.address_line_1 as string | null) ?? null,
      addressLine2: (listing.address_line_2 as string | null) ?? null,
      town: (listing.town as string | null) ?? null,
      postcode: (listing.postcode as string | null) ?? null,
      country: (listing.country as string | null) ?? 'GB',
      sector: (listing.sector as string | null) ?? null,
      latitude: num(listing.latitude),
      longitude: num(listing.longitude),
      createdBy: input.createdBy,
    });

    await this.linkListingToProperty({
      accountId: input.accountId,
      listingId: input.listingId,
      propertyId: property.id,
    });

    const instructingClientId = listing.instructing_client_id as string | null;
    if (instructingClientId) {
      try {
        await this.addParty({
          accountId: input.accountId,
          propertyId: property.id,
          role: 'landlord',
          clientId: instructingClientId,
        });
      } catch {
        // Already linked or RLS — non-fatal
      }
    }

    return property;
  }
}
