'use client';

import { useCallback, useRef, useState } from 'react';

import Link from 'next/link';

import { CsvImportWizard } from '~/components/bulk-import/csv-import-wizard';
import pathsConfig from '~/config/paths.config';
import type { DisposalType } from '~/lib/commercial/commercial-constants';
import {
  LISTING_CSV_FIELD_OPTIONS,
  buildListingImportTemplateCsv,
} from '~/lib/commercial/listing-csv-fields';
import { parseCsvDetectingHeader } from '~/lib/csv/parse-csv';
import type { CsvFieldMapping } from '~/lib/csv/rows-to-records';

import {
  commitListingImportAction,
  previewListingImportAction,
  suggestListingImportMappingAction,
} from '../_lib/server/listing-import-actions';

export function ListingImportPageClient({
  accountId,
  accountSlug,
}: {
  accountId: string;
  accountSlug: string;
}) {
  const [defaultDisposalType, setDefaultDisposalType] =
    useState<DisposalType>('to_let');
  const previewCache = useRef<{
    drafts: Awaited<ReturnType<typeof previewListingImportAction>>['drafts'];
    duplicates: Awaited<
      ReturnType<typeof previewListingImportAction>
    >['duplicates'];
  } | null>(null);

  const backHref = pathsConfig.app.accountListings.replace(
    '[account]',
    accountSlug,
  );
  const unitsImportHref = pathsConfig.app.accountListingUnitsImport.replace(
    '[account]',
    accountSlug,
  );

  const onSuggestMapping = useCallback(
    async (input: { headers: string[]; sampleRows: string[][] }) => {
      return suggestListingImportMappingAction({
        accountId,
        headers: input.headers,
        sampleRows: input.sampleRows,
      });
    },
    [accountId],
  );

  const onPreview = useCallback(
    async (input: {
      headers: string[];
      rows: string[][];
      mapping: CsvFieldMapping;
    }) => {
      const result = await previewListingImportAction({
        accountId,
        headers: input.headers,
        rows: input.rows,
        mapping: input.mapping,
        defaultDisposalType,
      });
      previewCache.current = {
        drafts: result.drafts,
        duplicates: result.duplicates,
      };

      return {
        previewRows: result.drafts.map((draft) => ({
          id: String(draft.rowIndex),
          label:
            draft.name || draft.addressLine1 || `Row ${draft.rowIndex + 1}`,
          detail: [draft.town, draft.postcode, draft.disposalType, draft.status]
            .filter(Boolean)
            .join(' · '),
          errors: draft.errors,
        })),
        duplicateRows: result.duplicates.map((dup) => {
          const draft = result.drafts.find((d) => d.rowIndex === dup.rowIndex);
          return {
            id: String(dup.rowIndex),
            incomingLabel:
              draft?.name || draft?.addressLine1 || `Row ${dup.rowIndex + 1}`,
            existingLabel: dup.existing.name || dup.existing.id,
            matchReason:
              dup.matchReason === 'external_id'
                ? 'Same external ID'
                : 'Same address + postcode',
          };
        }),
        validCount: result.validCount,
        errorCount: result.errorCount,
      };
    },
    [accountId, defaultDisposalType],
  );

  const onCommit = useCallback(
    async (input: {
      headers: string[];
      rows: string[][];
      mapping: CsvFieldMapping;
      duplicateActions: Record<string, 'keep' | 'overwrite' | 'create_new'>;
    }) => {
      const result = await commitListingImportAction({
        accountId,
        accountSlug,
        headers: input.headers,
        rows: input.rows,
        mapping: input.mapping,
        defaultDisposalType,
        duplicateActions: input.duplicateActions,
      });

      const parts = [
        result.imported ? `${result.imported} imported` : null,
        result.updated ? `${result.updated} updated` : null,
        result.skipped ? `${result.skipped} skipped` : null,
        result.failed.length ? `${result.failed.length} failed` : null,
      ].filter(Boolean);

      return {
        summary: parts.length
          ? `Import complete: ${parts.join(', ')}.`
          : 'Nothing was imported.',
        failedCount: result.failed.length,
      };
    },
    [accountId, accountSlug, defaultDisposalType],
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 pt-4 md:px-0">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-[var(--workspace-shell-text)]/60">
            Default disposal type
          </span>
          <select
            className="rounded-lg border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] px-3 py-1.5 text-[var(--workspace-shell-text)]"
            value={defaultDisposalType}
            onChange={(e) =>
              setDefaultDisposalType(e.target.value as DisposalType)
            }
          >
            <option value="to_let">To let (Lettings sheet)</option>
            <option value="for_sale">For sale (Sales sheet)</option>
            <option value="investment">Investment</option>
          </select>
        </div>
        <Link
          href={unitsImportHref}
          className="text-sm text-[var(--workspace-shell-text)]/70 underline-offset-2 hover:underline"
        >
          Import floor units instead →
        </Link>
      </div>

      <CsvImportWizard
        title="Import disposals"
        description="Upload a CSV of disposals. Map columns, resolve duplicates, then import."
        backHref={backHref}
        fieldOptions={LISTING_CSV_FIELD_OPTIONS}
        enableDuplicateReview
        parseCsvText={(text) =>
          parseCsvDetectingHeader(text, ['id', 'address'])
        }
        template={{
          filename: 'ozer-disposals-template.csv',
          csv: buildListingImportTemplateCsv(),
        }}
        onSuggestMapping={onSuggestMapping}
        onPreview={onPreview}
        onCommit={onCommit}
      />
    </div>
  );
}
