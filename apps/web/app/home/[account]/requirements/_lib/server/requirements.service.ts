import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import type { RequirementStatus } from '~/lib/commercial/commercial-constants';
import { normalizeRequirementStage } from '~/lib/commercial/commercial-constants';
import { geocodeListingAddress } from '~/lib/commercial/geocode-listing';

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
  useClass: string | null;
  detailsSent: boolean;
  detailsNote: string | null;
  externalKey: string | null;
  tenure: 'rent' | 'buy' | 'both' | null;
  locationText: string | null;
  latitude: number | null;
  longitude: number | null;
  searchRadiusMiles: number | null;
  branchId: string | null;
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
    useClass: (row.use_class as string | null) ?? null,
    detailsSent: Boolean(row.details_sent),
    detailsNote: (row.details_note as string | null) ?? null,
    externalKey: (row.external_key as string | null) ?? null,
    tenure: (row.tenure as CommercialRequirement['tenure']) ?? null,
    locationText: (row.location_text as string | null) ?? null,
    latitude: num(row.latitude),
    longitude: num(row.longitude),
    searchRadiusMiles: num(row.search_radius_miles),
    branchId: (row.branch_id as string | null) ?? null,
    sizeMinSqft: num(row.size_min_sqft),
    sizeMaxSqft: num(row.size_max_sqft),
    budgetMinPence: num(row.budget_min_pence),
    budgetMaxPence: num(row.budget_max_pence),
    stage: normalizeRequirementStage((row.stage as string | null) ?? 'new'),
    assignedTo: (row.assigned_to as string | null) ?? null,
    notes: (row.notes as string | null) ?? null,
    source: (row.source as string | null) ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function resolveRequirementCoords(input: {
  latitude?: number | null;
  longitude?: number | null;
  locationText?: string | null;
}): Promise<{ latitude: number | null; longitude: number | null }> {
  let latitude = input.latitude ?? null;
  let longitude = input.longitude ?? null;
  if (latitude != null && longitude != null) {
    return { latitude, longitude };
  }

  const locationText = input.locationText?.trim() || null;
  if (!locationText) {
    return { latitude, longitude };
  }

  const geo = await geocodeListingAddress({
    postcode: locationText,
    addressLine1: locationText,
  });
  if (geo) {
    latitude = geo.latitude;
    longitude = geo.longitude;
  }
  return { latitude, longitude };
}

export function createRequirementsService(client: SupabaseClient) {
  return {
    async listRequirements(
      accountId: string,
      stage?: RequirementStatus,
      search?: string,
    ): Promise<CommercialRequirement[]> {
      let query = client
        .from('commercial_requirements')
        .select('*')
        .eq('account_id', accountId)
        .order('updated_at', { ascending: false });

      if (stage) query = query.eq('stage', stage);

      const searchTerm = search?.trim();
      if (searchTerm) {
        const likePattern = `%${searchTerm.replace(/[%_\\]/g, '\\$&')}%`;
        const quotedLike = `"${likePattern.replace(/"/g, '')}"`;
        query = query.or(
          [
            `contact_name.ilike.${quotedLike}`,
            `company_name.ilike.${quotedLike}`,
          ].join(','),
        );
      }

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
      const { latitude, longitude } = await resolveRequirementCoords({
        latitude: input.latitude,
        longitude: input.longitude,
        locationText: input.locationText,
      });

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
          use_class: input.useClass ?? null,
          details_sent: input.detailsSent ?? false,
          details_note: input.detailsNote ?? null,
          external_key: input.externalKey ?? null,
          tenure: input.tenure ?? null,
          location_text: input.locationText ?? null,
          latitude,
          longitude,
          search_radius_miles: input.searchRadiusMiles ?? null,
          branch_id: input.branchId ?? null,
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
      const requirement = mapRequirement(data as Row);
      try {
        const { recordCommercialAccountEvent } =
          await import('~/lib/commercial/account-events');
        const label =
          requirement.companyName?.trim() ||
          requirement.contactName?.trim() ||
          requirement.locationText?.trim() ||
          'Requirement';
        await recordCommercialAccountEvent(client, {
          accountId: input.accountId,
          entityType: 'requirement',
          entityId: requirement.id,
          eventType: 'requirement_created',
          summary: `Requirement created — ${label}`,
          actorUserId: input.createdBy ?? null,
          metadata: {
            stage: requirement.stage,
            sector: requirement.sector,
          },
        });
      } catch {
        /* best-effort */
      }
      return requirement;
    },

    async updateRequirement(
      requirementId: string,
      accountId: string,
      input: Omit<UpdateRequirementInput, 'requirementId' | 'accountId'>,
      options?: { actorUserId?: string | null },
    ): Promise<CommercialRequirement> {
      const { data: existingRow, error: existingError } = await client
        .from('commercial_requirements')
        .select('*')
        .eq('id', requirementId)
        .eq('account_id', accountId)
        .maybeSingle();

      if (existingError || !existingRow) {
        throw new Error(
          existingError?.message ?? 'Requirement not found for this account',
        );
      }

      const existing = mapRequirement(existingRow as Row);
      const patch: Record<string, unknown> = {
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
        ...(input.useClass !== undefined && { use_class: input.useClass }),
        ...(input.detailsSent !== undefined && {
          details_sent: input.detailsSent,
        }),
        ...(input.detailsNote !== undefined && {
          details_note: input.detailsNote,
        }),
        ...(input.externalKey !== undefined && {
          external_key: input.externalKey,
        }),
        ...(input.tenure !== undefined && { tenure: input.tenure }),
        ...(input.locationText !== undefined && {
          location_text: input.locationText,
        }),
        ...(input.latitude !== undefined && { latitude: input.latitude }),
        ...(input.longitude !== undefined && { longitude: input.longitude }),
        ...(input.searchRadiusMiles !== undefined && {
          search_radius_miles: input.searchRadiusMiles,
        }),
        ...(input.branchId !== undefined && { branch_id: input.branchId }),
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
      };

      const locationChanged =
        input.locationText !== undefined &&
        (input.locationText?.trim() || null) !==
          (existing.locationText?.trim() || null);

      const coordsProvided =
        input.latitude !== undefined || input.longitude !== undefined;
      const missingCoords = coordsProvided
        ? (input.latitude ?? existing.latitude) == null ||
          (input.longitude ?? existing.longitude) == null
        : existing.latitude == null || existing.longitude == null;

      if (!coordsProvided && (locationChanged || missingCoords)) {
        const locationText =
          input.locationText !== undefined
            ? input.locationText
            : existing.locationText;
        const geo = await resolveRequirementCoords({
          locationText,
        });
        if (geo.latitude != null && geo.longitude != null) {
          patch.latitude = geo.latitude;
          patch.longitude = geo.longitude;
        }
      }

      const { data, error } = await client
        .from('commercial_requirements')
        .update(patch)
        .eq('id', requirementId)
        .eq('account_id', accountId)
        .select('*')
        .single();

      if (error || !data) {
        throw new Error(error?.message ?? 'Failed to update requirement');
      }
      const requirement = mapRequirement(data as Row);
      if (input.stage && input.stage !== existing.stage) {
        try {
          const { recordCommercialAccountEvent } =
            await import('~/lib/commercial/account-events');
          await recordCommercialAccountEvent(client, {
            accountId,
            entityType: 'requirement',
            entityId: requirement.id,
            eventType: 'requirement_stage_changed',
            summary: `Requirement stage ${existing.stage} → ${input.stage}`,
            actorUserId: options?.actorUserId ?? null,
            metadata: {
              previousStage: existing.stage,
              stage: input.stage,
            },
          });
        } catch {
          /* best-effort */
        }
      }
      return requirement;
    },

    async appendNotes(
      requirementId: string,
      accountId: string,
      noteBlock: string,
      opts?: { stage?: UpdateRequirementInput['stage'] },
    ): Promise<CommercialRequirement> {
      const { data: existingRow, error: existingError } = await client
        .from('commercial_requirements')
        .select('*')
        .eq('id', requirementId)
        .eq('account_id', accountId)
        .maybeSingle();

      if (existingError || !existingRow) {
        throw new Error(
          existingError?.message ?? 'Requirement not found for this account',
        );
      }

      const existing = mapRequirement(existingRow as Row);
      const nextNotes = existing.notes?.trim()
        ? `${existing.notes.trim()}\n\n${noteBlock}`
        : noteBlock;

      return this.updateRequirement(requirementId, accountId, {
        notes: nextNotes,
        ...(opts?.stage ? { stage: opts.stage } : {}),
      });
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

    async listOffices(
      accountId: string,
    ): Promise<Array<{ id: string; name: string; isDefault: boolean }>> {
      const { data, error } = await client
        .from('account_branches')
        .select('id, name, is_default, sort_order')
        .eq('account_id', accountId)
        .order('sort_order', { ascending: true })
        .order('name', { ascending: true });

      if (error) throw new Error(error.message);

      return (
        (data ?? []) as Array<{
          id: string;
          name: string | null;
          is_default?: boolean | null;
        }>
      ).map((row) => ({
        id: row.id,
        name: row.name?.trim() || 'Office',
        isDefault: Boolean(row.is_default),
      }));
    },
  };
}
