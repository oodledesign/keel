import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import type { RequirementStatus } from '~/lib/commercial/commercial-constants';
import { normalizeRequirementStage } from '~/lib/commercial/commercial-constants';

import type {
  CreateRequirementInput,
  UpdateRequirementInput,
} from '../schema/requirements.schema';

export type CommercialRequirement = {
  id: string;
  accountId: string;
  clientId: string | null;
  contactId: string | null;
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  companyName: string | null;
  sector: string | null;
  tenure: 'rent' | 'buy' | 'both' | null;
  locationText: string | null;
  sizeMinSqft: number | null;
  sizeMaxSqft: number | null;
  budgetMinPence: number | null;
  budgetMaxPence: number | null;
  stage: RequirementStatus;
  assignedTo: string | null;
  notes: string | null;
  source: string | null;
  createdAt: string;
  updatedAt: string;
};

type Row = Record<string, unknown> & {
  id: string;
  account_id: string;
  created_at: string;
  updated_at: string;
};

function num(value: unknown): number | null {
  if (value == null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function mapRequirement(row: Row): CommercialRequirement {
  return {
    id: row.id,
    accountId: row.account_id,
    clientId: (row.client_id as string | null) ?? null,
    contactId: (row.contact_id as string | null) ?? null,
    contactName: (row.contact_name as string | null) ?? null,
    contactEmail: (row.contact_email as string | null) ?? null,
    contactPhone: (row.contact_phone as string | null) ?? null,
    companyName: (row.company_name as string | null) ?? null,
    sector: (row.sector as string | null) ?? null,
    tenure: (row.tenure as CommercialRequirement['tenure']) ?? null,
    locationText: (row.location_text as string | null) ?? null,
    sizeMinSqft: num(row.size_min_sqft),
    sizeMaxSqft: num(row.size_max_sqft),
    budgetMinPence: num(row.budget_min_pence),
    budgetMaxPence: num(row.budget_max_pence),
    stage: normalizeRequirementStage(
      (row.stage as string | null) ?? 'new',
    ),
    assignedTo: (row.assigned_to as string | null) ?? null,
    notes: (row.notes as string | null) ?? null,
    source: (row.source as string | null) ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function createRequirementsService(client: SupabaseClient) {
  return {
    async listRequirements(
      accountId: string,
      stage?: RequirementStatus,
    ): Promise<CommercialRequirement[]> {
      let query = client
        .from('commercial_requirements')
        .select('*')
        .eq('account_id', accountId)
        .order('updated_at', { ascending: false });

      if (stage) query = query.eq('stage', stage);

      const { data, error } = await query;
      if (error) {
        console.error('[requirements] list error:', error.message);
        return [];
      }
      return ((data ?? []) as Row[]).map(mapRequirement);
    },

    async createRequirement(
      input: CreateRequirementInput & { createdBy?: string | null },
    ): Promise<CommercialRequirement> {
      const { data, error } = await client
        .from('commercial_requirements')
        .insert({
          account_id: input.accountId,
          client_id: input.clientId ?? null,
          contact_id: input.contactId ?? null,
          contact_name: input.contactName ?? null,
          contact_email: input.contactEmail ?? null,
          contact_phone: input.contactPhone ?? null,
          company_name: input.companyName ?? null,
          sector: input.sector ?? null,
          tenure: input.tenure ?? null,
          location_text: input.locationText ?? null,
          size_min_sqft: input.sizeMinSqft ?? null,
          size_max_sqft: input.sizeMaxSqft ?? null,
          budget_min_pence: input.budgetMinPence ?? null,
          budget_max_pence: input.budgetMaxPence ?? null,
          stage: input.stage ?? 'new',
          notes: input.notes ?? null,
          source: input.source ?? null,
          created_by: input.createdBy ?? null,
        })
        .select('*')
        .single();

      if (error || !data) {
        throw new Error(error?.message ?? 'Failed to create requirement');
      }
      return mapRequirement(data as Row);
    },

    async updateRequirement(
      requirementId: string,
      accountId: string,
      input: Omit<UpdateRequirementInput, 'requirementId' | 'accountId'>,
    ): Promise<CommercialRequirement> {
      const { data, error } = await client
        .from('commercial_requirements')
        .update({
          ...(input.clientId !== undefined && { client_id: input.clientId }),
          ...(input.contactId !== undefined && { contact_id: input.contactId }),
          ...(input.contactName !== undefined && {
            contact_name: input.contactName,
          }),
          ...(input.contactEmail !== undefined && {
            contact_email: input.contactEmail,
          }),
          ...(input.contactPhone !== undefined && {
            contact_phone: input.contactPhone,
          }),
          ...(input.companyName !== undefined && {
            company_name: input.companyName,
          }),
          ...(input.sector !== undefined && { sector: input.sector }),
          ...(input.tenure !== undefined && { tenure: input.tenure }),
          ...(input.locationText !== undefined && {
            location_text: input.locationText,
          }),
          ...(input.sizeMinSqft !== undefined && {
            size_min_sqft: input.sizeMinSqft,
          }),
          ...(input.sizeMaxSqft !== undefined && {
            size_max_sqft: input.sizeMaxSqft,
          }),
          ...(input.budgetMinPence !== undefined && {
            budget_min_pence: input.budgetMinPence,
          }),
          ...(input.budgetMaxPence !== undefined && {
            budget_max_pence: input.budgetMaxPence,
          }),
          ...(input.stage !== undefined && { stage: input.stage }),
          ...(input.notes !== undefined && { notes: input.notes }),
          ...(input.source !== undefined && { source: input.source }),
          updated_at: new Date().toISOString(),
        })
        .eq('id', requirementId)
        .eq('account_id', accountId)
        .select('*')
        .single();

      if (error || !data) {
        throw new Error(error?.message ?? 'Failed to update requirement');
      }
      return mapRequirement(data as Row);
    },

    async deleteRequirement(
      requirementId: string,
      accountId: string,
    ): Promise<void> {
      const { error } = await client
        .from('commercial_requirements')
        .delete()
        .eq('id', requirementId)
        .eq('account_id', accountId);
      if (error) throw new Error(error.message);
    },
  };
}
