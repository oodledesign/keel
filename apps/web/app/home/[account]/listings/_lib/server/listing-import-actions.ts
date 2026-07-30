'use server';

import { revalidatePath } from 'next/cache';

import { z } from 'zod';

import { enhanceAction } from '@kit/next/actions';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

import pathsConfig from '~/config/paths.config';
import { DISPOSAL_TYPES } from '~/lib/commercial/commercial-constants';
import {
  heuristicListingMapping,
  normalizeListingCsvMapping,
} from '~/lib/commercial/listing-csv-fields';
import {
  type ExistingListingSnapshot,
  type ListingDuplicateMatch,
  findListingDuplicate,
  recordToListingDraft,
} from '~/lib/commercial/listing-import';
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
  throw new Error('You do not have permission to import listings');
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
  defaultDisposalType: z.enum(DISPOSAL_TYPES).optional(),
});

const commitSchema = z.object({
  accountId: z.string().uuid(),
  accountSlug: z.string().min(1),
  headers: z.array(z.string()).min(1).max(100),
  rows: z.array(z.array(z.string())).max(5000),
  mapping: mappingSchema,
  defaultDisposalType: z.enum(DISPOSAL_TYPES).optional(),
  duplicateActions: z.record(
    z.string(),
    z.enum(['keep', 'overwrite', 'create_new']),
  ),
});

export const suggestListingImportMappingAction = enhanceAction(
  async (input) => {
    await assertCanEditListings(input.accountId);
    const result = heuristicListingMapping(input.headers);
    return {
      mapping: normalizeListingCsvMapping(input.headers, result.mapping),
      notes: result.notes,
      aiUsed: false,
    };
  },
  { schema: suggestSchema },
);

export const previewListingImportAction = enhanceAction(
  async (input) => {
    const client = getSupabaseServerClient();
    await assertCanEditListings(input.accountId);

    const records = applyCsvColumnMapping(
      input.headers,
      input.rows,
      input.mapping as CsvFieldMapping,
    );

    const drafts = records.map((record, index) =>
      recordToListingDraft(
        index,
        record,
        input.defaultDisposalType ?? 'to_let',
      ),
    );

    const service = createListingsService(client);
    const listings = await service.listListings(input.accountId);
    const existing: ExistingListingSnapshot[] = listings.map((l) => ({
      id: l.id,
      name: l.name,
      addressLine1: l.addressLine1,
      town: l.town,
      postcode: l.postcode,
      externalId: l.externalId,
    }));

    const duplicates: ListingDuplicateMatch[] = [];
    for (const draft of drafts) {
      if (draft.errors.length) continue;
      const match = findListingDuplicate(draft, existing);
      if (match) duplicates.push(match);
    }

    return {
      drafts,
      duplicates,
      validCount: drafts.filter((d) => d.errors.length === 0).length,
      errorCount: drafts.filter((d) => d.errors.length > 0).length,
    };
  },
  { schema: previewSchema },
);

export const commitListingImportAction = enhanceAction(
  async (input) => {
    const client = getSupabaseServerClient();
    const service = createListingsService(client);
    await assertCanEditListings(input.accountId);

    const {
      data: { user },
    } = await client.auth.getUser();

    const records = applyCsvColumnMapping(
      input.headers,
      input.rows,
      input.mapping as CsvFieldMapping,
    );
    const drafts = records.map((record, index) =>
      recordToListingDraft(
        index,
        record,
        input.defaultDisposalType ?? 'to_let',
      ),
    );

    const listings = await service.listListings(input.accountId);
    const existing: ExistingListingSnapshot[] = listings.map((l) => ({
      id: l.id,
      name: l.name,
      addressLine1: l.addressLine1,
      town: l.town,
      postcode: l.postcode,
      externalId: l.externalId,
    }));

    let imported = 0;
    let updated = 0;
    let skipped = 0;
    const failed: Array<{ rowIndex: number; error: string }> = [];

    for (const draft of drafts) {
      try {
        if (draft.errors.length) {
          failed.push({
            rowIndex: draft.rowIndex,
            error: draft.errors.join('; '),
          });
          continue;
        }

        const match = findListingDuplicate(draft, existing);
        const action = match
          ? (input.duplicateActions[String(draft.rowIndex)] ?? 'keep')
          : 'create_new';

        if (action === 'keep') {
          skipped += 1;
          continue;
        }

        const payload = {
          name: draft.name,
          addressLine1: draft.addressLine1,
          addressLine2: draft.addressLine2,
          town: draft.town,
          postcode: draft.postcode,
          status: draft.status,
          disposalType: draft.disposalType,
          sector: draft.sector,
          tenure: draft.tenure,
          sizeMinSqft: draft.sizeMinSqft,
          sizeMaxSqft: draft.sizeMaxSqft,
          askingRentPence: draft.askingRentPence,
          askingPricePence: draft.askingPricePence,
          rentFrequency: draft.rentFrequency,
          summary: draft.summary,
          description: draft.description,
          notes: draft.notes,
          externalId: draft.externalId,
        };

        if (action === 'overwrite') {
          if (!match) {
            failed.push({
              rowIndex: draft.rowIndex,
              error: 'Overwrite requires a matched existing listing',
            });
            continue;
          }

          await service.updateListing(
            match.existing.id,
            input.accountId,
            payload,
          );
          updated += 1;
          continue;
        }

        const created = await service.createListing({
          accountId: input.accountId,
          createdBy: user?.id ?? null,
          ...payload,
        });
        existing.push({
          id: created.id,
          name: created.name,
          addressLine1: created.addressLine1,
          town: created.town,
          postcode: created.postcode,
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
