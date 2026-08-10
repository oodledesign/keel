'use server';

import { revalidatePath } from 'next/cache';

import { z } from 'zod';

import { enhanceAction } from '@kit/next/actions';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

import pathsConfig from '~/config/paths.config';
import {
  heuristicUnitMapping,
  normalizeUnitCsvMapping,
} from '~/lib/commercial/unit-csv-fields';
import {
  type ExistingUnitSnapshot,
  type ListingAddressSnapshot,
  type UnitDuplicateMatch,
  findListingIdForUnitAddress,
  findUnitDuplicate,
  recordToUnitDraft,
} from '~/lib/commercial/unit-import';
import {
  type CsvFieldMapping,
  applyCsvColumnMapping,
} from '~/lib/csv/rows-to-records';

import { createListingsService } from './listings.service';

async function assertCanEditListings(accountId: string) {
  const client = getSupabaseServerClient();
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) throw new Error('Unauthorized');

  const { createTeamAccountsApi } = await import('@kit/team-accounts/api');
  const api = createTeamAccountsApi(client);
  const hasPermission = await api.hasPermission({
    userId: user.id,
    accountId,
    permission: 'listings.edit' as never,
  });
  if (hasPermission) return;

  const { data: membership } = await client
    .from('accounts_memberships')
    .select('account_role')
    .eq('account_id', accountId)
    .eq('user_id', user.id)
    .maybeSingle();

  const role = membership?.account_role;
  if (role === 'owner' || role === 'admin' || role === 'staff') return;
  throw new Error('You do not have permission to import units');
}

const mappingSchema = z.record(z.string(), z.string());

const suggestSchema = z.object({
  accountId: z.string().uuid(),
  headers: z.array(z.string()).min(1).max(100),
  sampleRows: z.array(z.array(z.string())).max(10),
});

const previewSchema = z.object({
  accountId: z.string().uuid(),
  headers: z.array(z.string()).min(1).max(100),
  rows: z.array(z.array(z.string())).max(5000),
  mapping: mappingSchema,
});

const commitSchema = z.object({
  accountId: z.string().uuid(),
  accountSlug: z.string().min(1),
  headers: z.array(z.string()).min(1).max(100),
  rows: z.array(z.array(z.string())).max(5000),
  mapping: mappingSchema,
  duplicateActions: z.record(
    z.string(),
    z.enum(['keep', 'overwrite', 'create_new']),
  ),
});

export const suggestUnitImportMappingAction = enhanceAction(
  async (input) => {
    await assertCanEditListings(input.accountId);
    const result = heuristicUnitMapping(input.headers);
    return {
      mapping: normalizeUnitCsvMapping(input.headers, result.mapping),
      notes: result.notes,
      aiUsed: false,
    };
  },
  { schema: suggestSchema },
);

export const previewUnitImportAction = enhanceAction(
  async (input) => {
    const client = getSupabaseServerClient();
    await assertCanEditListings(input.accountId);

    const records = applyCsvColumnMapping(
      input.headers,
      input.rows,
      input.mapping as CsvFieldMapping,
    );

    const drafts = records.map((record, index) =>
      recordToUnitDraft(index, record),
    );

    const service = createListingsService(client);
    const listings = await service.listListings(input.accountId);
    const listingSnapshots: ListingAddressSnapshot[] = listings.map((l) => ({
      id: l.id,
      addressLine1: l.addressLine1,
      name: l.name,
    }));

    const units = await service.listUnitsForAccount(input.accountId);
    const existingUnits: ExistingUnitSnapshot[] = units.map((u) => ({
      id: u.id,
      listingId: u.listingId,
      label: u.label,
      floorOrUnit: u.floorOrUnit,
      externalId: u.externalId,
    }));

    const duplicates: UnitDuplicateMatch[] = [];
    const enriched = drafts.map((draft) => {
      if (draft.errors.length) return draft;
      const listingId = findListingIdForUnitAddress(
        draft.listingAddress,
        listingSnapshots,
      );
      if (!listingId) {
        return {
          ...draft,
          errors: [
            ...draft.errors,
            `No listing found matching address "${draft.listingAddress}"`,
          ],
        };
      }
      const match = findUnitDuplicate(draft, listingId, existingUnits);
      if (match) duplicates.push(match);
      return draft;
    });

    return {
      drafts: enriched,
      duplicates,
      validCount: enriched.filter((d) => d.errors.length === 0).length,
      errorCount: enriched.filter((d) => d.errors.length > 0).length,
    };
  },
  { schema: previewSchema },
);

export const commitUnitImportAction = enhanceAction(
  async (input) => {
    const client = getSupabaseServerClient();
    const service = createListingsService(client);
    await assertCanEditListings(input.accountId);

    const records = applyCsvColumnMapping(
      input.headers,
      input.rows,
      input.mapping as CsvFieldMapping,
    );
    const drafts = records.map((record, index) =>
      recordToUnitDraft(index, record),
    );

    const listings = await service.listListings(input.accountId);
    const listingSnapshots: ListingAddressSnapshot[] = listings.map((l) => ({
      id: l.id,
      addressLine1: l.addressLine1,
      name: l.name,
    }));

    const units = await service.listUnitsForAccount(input.accountId);
    const existingUnits: ExistingUnitSnapshot[] = units.map((u) => ({
      id: u.id,
      listingId: u.listingId,
      label: u.label,
      floorOrUnit: u.floorOrUnit,
      externalId: u.externalId,
    }));

    let imported = 0;
    let updated = 0;
    let skipped = 0;
    const failed: Array<{ rowIndex: number; error: string }> = [];

    for (const draft of drafts) {
      try {
        const listingId = findListingIdForUnitAddress(
          draft.listingAddress,
          listingSnapshots,
        );

        const errors = [...draft.errors];
        if (!listingId) {
          errors.push(
            `No listing found matching address "${draft.listingAddress}"`,
          );
        }

        if (errors.length || !listingId) {
          failed.push({
            rowIndex: draft.rowIndex,
            error: errors.join('; '),
          });
          continue;
        }

        const match = findUnitDuplicate(draft, listingId, existingUnits);
        const action = match
          ? (input.duplicateActions[String(draft.rowIndex)] ?? 'keep')
          : 'create_new';

        if (action === 'keep') {
          skipped += 1;
          continue;
        }

        if (action === 'overwrite') {
          if (!match) {
            failed.push({
              rowIndex: draft.rowIndex,
              error: 'Overwrite requires a matched existing unit',
            });
            continue;
          }

          await service.updateUnit(match.existing.id, input.accountId, {
            label: draft.label,
            floorOrUnit: draft.floorOrUnit,
            description: draft.description,
            partFloor: draft.partFloor,
            sector: draft.sector,
            tenure: draft.tenure,
            status: draft.status,
            sizeSqft: draft.sizeSqft,
            askingRentPence: draft.askingRentPence,
            rentPerSqft: draft.rentPerSqft,
            serviceChargePerSqft: draft.serviceChargePerSqft,
            ratesPayablePerSqft: draft.ratesPayablePerSqft,
            estateChargePerSqft: draft.estateChargePerSqft,
            epcBand: draft.epcBand,
            possession: draft.possession,
            buildStatus: draft.buildStatus,
            planningStatus: draft.planningStatus,
            fittedSpace: draft.fittedSpace,
            notes: draft.notes,
            externalId: draft.externalId,
          });
          updated += 1;
          continue;
        }

        const created = await service.createUnit({
          accountId: input.accountId,
          listingId,
          label: draft.label,
          floorOrUnit: draft.floorOrUnit,
          description: draft.description,
          partFloor: draft.partFloor,
          sector: draft.sector,
          tenure: draft.tenure,
          status: draft.status,
          sizeSqft: draft.sizeSqft,
          askingRentPence: draft.askingRentPence,
          rentPerSqft: draft.rentPerSqft,
          serviceChargePerSqft: draft.serviceChargePerSqft,
          ratesPayablePerSqft: draft.ratesPayablePerSqft,
          estateChargePerSqft: draft.estateChargePerSqft,
          epcBand: draft.epcBand,
          possession: draft.possession,
          buildStatus: draft.buildStatus,
          planningStatus: draft.planningStatus,
          fittedSpace: draft.fittedSpace,
          notes: draft.notes,
          externalId: draft.externalId,
          sortOrder: imported + updated,
        });
        existingUnits.push({
          id: created.id,
          listingId: created.listingId,
          label: created.label,
          floorOrUnit: created.floorOrUnit,
          externalId: created.externalId,
        });
        imported += 1;
      } catch (err) {
        failed.push({
          rowIndex: draft.rowIndex,
          error: err instanceof Error ? err.message : 'Failed to import row',
        });
      }
    }

    const listingsPath = pathsConfig.app.accountListings.replace(
      '[account]',
      input.accountSlug,
    );
    revalidatePath(listingsPath, 'page');
    revalidatePath(`/home/${input.accountSlug}/listings`, 'page');

    return { imported, updated, skipped, failed };
  },
  { schema: commitSchema },
);
