import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import type { LeaseStatus } from '~/lib/commercial/commercial-constants';

import type {
  CreateLeaseInput,
  UpdateLeaseInput,
} from '../schema/leases.schema';

export type CommercialLease = {
  id: string;
  accountId: string;
  listingId: string | null;
  listingName: string | null;
  clientId: string | null;
  propertyLabel: string;
  town: string | null;
  postcode: string | null;
  tenantName: string | null;
  headlineRentPsf: number | null;
  leaseStart: string | null;
  leaseEnd: string | null;
  status: LeaseStatus;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

type Row = Record<string, unknown> & {
  id: string;
  account_id: string;
  property_label: string;
  created_at: string;
  updated_at: string;
  commercial_listings?: { name?: string | null } | null;
};

function mapLease(row: Row): CommercialLease {
  return {
    id: row.id,
    accountId: row.account_id,
    listingId: (row.listing_id as string | null) ?? null,
    listingName: row.commercial_listings?.name ?? null,
    clientId: (row.client_id as string | null) ?? null,
    propertyLabel: row.property_label,
    town: (row.town as string | null) ?? null,
    postcode: (row.postcode as string | null) ?? null,
    tenantName: (row.tenant_name as string | null) ?? null,
    headlineRentPsf:
      row.headline_rent_psf != null ? Number(row.headline_rent_psf) : null,
    leaseStart: (row.lease_start as string | null) ?? null,
    leaseEnd: (row.lease_end as string | null) ?? null,
    status: (row.status as LeaseStatus) ?? 'active',
    notes: (row.notes as string | null) ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function createLeasesService(client: SupabaseClient) {
  return {
    async listLeases(accountId: string): Promise<CommercialLease[]> {
      const { data, error } = await client
        .from('commercial_leases')
        .select('*, commercial_listings(name)')
        .eq('account_id', accountId)
        .order('lease_start', { ascending: false, nullsFirst: false });

      if (error) {
        console.error('[leases] list error:', error.message);
        return [];
      }
      return ((data ?? []) as Row[]).map(mapLease);
    },

    async createLease(
      input: CreateLeaseInput & { createdBy?: string | null },
    ): Promise<CommercialLease> {
      const { data, error } = await client
        .from('commercial_leases')
        .insert({
          account_id: input.accountId,
          listing_id: input.listingId ?? null,
          client_id: input.clientId ?? null,
          property_label: input.propertyLabel,
          town: input.town ?? null,
          postcode: input.postcode ?? null,
          tenant_name: input.tenantName ?? null,
          headline_rent_psf: input.headlineRentPsf ?? null,
          lease_start: input.leaseStart ?? null,
          lease_end: input.leaseEnd ?? null,
          status: input.status ?? 'active',
          notes: input.notes ?? null,
          created_by: input.createdBy ?? null,
        })
        .select('*, commercial_listings(name)')
        .single();

      if (error || !data) {
        throw new Error(error?.message ?? 'Failed to create lease');
      }
      return mapLease(data as Row);
    },

    async updateLease(
      leaseId: string,
      accountId: string,
      input: Omit<UpdateLeaseInput, 'leaseId' | 'accountId'>,
    ): Promise<CommercialLease> {
      const { data, error } = await client
        .from('commercial_leases')
        .update({
          ...(input.listingId !== undefined && {
            listing_id: input.listingId,
          }),
          ...(input.clientId !== undefined && { client_id: input.clientId }),
          ...(input.propertyLabel !== undefined && {
            property_label: input.propertyLabel,
          }),
          ...(input.town !== undefined && { town: input.town }),
          ...(input.postcode !== undefined && { postcode: input.postcode }),
          ...(input.tenantName !== undefined && {
            tenant_name: input.tenantName,
          }),
          ...(input.headlineRentPsf !== undefined && {
            headline_rent_psf: input.headlineRentPsf,
          }),
          ...(input.leaseStart !== undefined && {
            lease_start: input.leaseStart,
          }),
          ...(input.leaseEnd !== undefined && { lease_end: input.leaseEnd }),
          ...(input.status !== undefined && { status: input.status }),
          ...(input.notes !== undefined && { notes: input.notes }),
          updated_at: new Date().toISOString(),
        })
        .eq('id', leaseId)
        .eq('account_id', accountId)
        .select('*, commercial_listings(name)')
        .single();

      if (error || !data) {
        throw new Error(error?.message ?? 'Failed to update lease');
      }
      return mapLease(data as Row);
    },

    async deleteLease(leaseId: string, accountId: string): Promise<void> {
      const { error } = await client
        .from('commercial_leases')
        .delete()
        .eq('id', leaseId)
        .eq('account_id', accountId);
      if (error) throw new Error(error.message);
    },
  };
}
