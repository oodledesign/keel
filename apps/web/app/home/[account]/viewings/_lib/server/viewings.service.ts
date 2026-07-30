import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import type { ViewingStatus } from '~/lib/commercial/commercial-constants';

import type {
  CreateViewingInput,
  UpdateViewingInput,
} from '../schema/viewings.schema';

export type CommercialViewing = {
  id: string;
  accountId: string;
  listingId: string;
  listingName: string | null;
  enquiryId: string | null;
  requirementId: string | null;
  clientId: string | null;
  clientName: string | null;
  contactId: string | null;
  contactName: string | null;
  scheduledAt: string | null;
  conductedBy: string | null;
  outcome: string | null;
  feedback: string | null;
  status: ViewingStatus;
  createdAt: string;
  updatedAt: string;
};

type Row = Record<string, unknown> & {
  id: string;
  account_id: string;
  listing_id: string;
  created_at: string;
  updated_at: string;
  commercial_listings?: { name?: string | null } | null;
  clients?: {
    display_name?: string | null;
    company_name?: string | null;
  } | null;
  contacts?: {
    full_name?: string | null;
    first_name?: string | null;
    last_name?: string | null;
  } | null;
};

function mapViewing(row: Row): CommercialViewing {
  const contactName =
    row.contacts?.full_name ||
    [row.contacts?.first_name, row.contacts?.last_name]
      .filter(Boolean)
      .join(' ') ||
    null;

  return {
    id: row.id,
    accountId: row.account_id,
    listingId: row.listing_id,
    listingName: row.commercial_listings?.name ?? null,
    enquiryId: (row.enquiry_id as string | null) ?? null,
    requirementId: (row.requirement_id as string | null) ?? null,
    clientId: (row.client_id as string | null) ?? null,
    clientName: row.clients?.display_name || row.clients?.company_name || null,
    contactId: (row.contact_id as string | null) ?? null,
    contactName: contactName || null,
    scheduledAt: (row.scheduled_at as string | null) ?? null,
    conductedBy: (row.conducted_by as string | null) ?? null,
    outcome: (row.outcome as string | null) ?? null,
    feedback: (row.feedback as string | null) ?? null,
    status: (row.status as ViewingStatus) ?? 'upcoming',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function createViewingsService(client: SupabaseClient) {
  return {
    async listViewings(accountId: string): Promise<CommercialViewing[]> {
      const selectWithLinks =
        '*, commercial_listings(name), clients(display_name, company_name), contacts(full_name, first_name, last_name)';
      const { data, error } = await client
        .from('commercial_viewings')
        .select(selectWithLinks)
        .eq('account_id', accountId)
        .order('scheduled_at', { ascending: true, nullsFirst: false });

      if (error) {
        // Fallback if contact_id / join columns are not migrated yet.
        const fallback = await client
          .from('commercial_viewings')
          .select('*, commercial_listings(name)')
          .eq('account_id', accountId)
          .order('scheduled_at', { ascending: true, nullsFirst: false });
        if (fallback.error) {
          console.error('[viewings] list error:', fallback.error.message);
          return [];
        }
        return ((fallback.data ?? []) as Row[]).map(mapViewing);
      }
      return ((data ?? []) as Row[]).map(mapViewing);
    },

    async createViewing(
      input: CreateViewingInput & { createdBy?: string | null },
    ): Promise<CommercialViewing> {
      const selectWithLinks =
        '*, commercial_listings(name), clients(display_name, company_name), contacts(full_name, first_name, last_name)';
      const { data, error } = await client
        .from('commercial_viewings')
        .insert({
          account_id: input.accountId,
          listing_id: input.listingId,
          enquiry_id: input.enquiryId ?? null,
          requirement_id: input.requirementId ?? null,
          client_id: input.clientId ?? null,
          contact_id: input.contactId ?? null,
          scheduled_at: input.scheduledAt ?? null,
          outcome: input.outcome ?? null,
          feedback: input.feedback ?? null,
          status: input.status ?? 'upcoming',
          created_by: input.createdBy ?? null,
        })
        .select(selectWithLinks)
        .single();

      if (error || !data) {
        throw new Error(error?.message ?? 'Failed to create viewing');
      }
      return mapViewing(data as Row);
    },

    async updateViewing(
      viewingId: string,
      accountId: string,
      input: Omit<UpdateViewingInput, 'viewingId' | 'accountId'>,
    ): Promise<CommercialViewing> {
      const selectWithLinks =
        '*, commercial_listings(name), clients(display_name, company_name), contacts(full_name, first_name, last_name)';
      const { data, error } = await client
        .from('commercial_viewings')
        .update({
          ...(input.listingId !== undefined && {
            listing_id: input.listingId,
          }),
          ...(input.enquiryId !== undefined && {
            enquiry_id: input.enquiryId,
          }),
          ...(input.requirementId !== undefined && {
            requirement_id: input.requirementId,
          }),
          ...(input.clientId !== undefined && { client_id: input.clientId }),
          ...(input.contactId !== undefined && {
            contact_id: input.contactId,
          }),
          ...(input.scheduledAt !== undefined && {
            scheduled_at: input.scheduledAt,
          }),
          ...(input.outcome !== undefined && { outcome: input.outcome }),
          ...(input.feedback !== undefined && { feedback: input.feedback }),
          ...(input.status !== undefined && { status: input.status }),
          updated_at: new Date().toISOString(),
        })
        .eq('id', viewingId)
        .eq('account_id', accountId)
        .select(selectWithLinks)
        .single();

      if (error || !data) {
        throw new Error(error?.message ?? 'Failed to update viewing');
      }
      return mapViewing(data as Row);
    },

    async deleteViewing(viewingId: string, accountId: string): Promise<void> {
      const { error } = await client
        .from('commercial_viewings')
        .delete()
        .eq('id', viewingId)
        .eq('account_id', accountId);
      if (error) throw new Error(error.message);
    },
  };
}
