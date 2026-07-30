'use client';

import { useCallback, useRef } from 'react';

import Link from 'next/link';

import { CsvImportWizard } from '~/components/bulk-import/csv-import-wizard';
import pathsConfig from '~/config/paths.config';
import {
  UNIT_CSV_FIELD_OPTIONS,
  buildUnitImportTemplateCsv,
} from '~/lib/commercial/unit-csv-fields';
import { parseCsvDetectingHeader } from '~/lib/csv/parse-csv';
import type { CsvFieldMapping } from '~/lib/csv/rows-to-records';

import {
  commitUnitImportAction,
  previewUnitImportAction,
  suggestUnitImportMappingAction,
} from '../_lib/server/unit-import-actions';

export function UnitImportPageClient({
  accountId,
  accountSlug,
}: {
  accountId: string;
  accountSlug: string;
}) {
  const previewCache = useRef<{
    drafts: Awaited<ReturnType<typeof previewUnitImportAction>>['drafts'];
    duplicates: Awaited<
      ReturnType<typeof previewUnitImportAction>
    >['duplicates'];
  } | null>(null);

  const backHref = pathsConfig.app.accountListings.replace(
    '[account]',
    accountSlug,
  );
  const listingsImportHref = pathsConfig.app.accountListingsImport.replace(
    '[account]',
    accountSlug,
  );

  const onSuggestMapping = useCallback(
    async (input: { headers: string[]; sampleRows: string[][] }) => {
      return suggestUnitImportMappingAction({
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
      const result = await previewUnitImportAction({
        accountId,
        headers: input.headers,
        rows: input.rows,
        mapping: input.mapping,
      });
      previewCache.current = {
        drafts: result.drafts,
        duplicates: result.duplicates,
      };

      return {
        previewRows: result.drafts.map((draft) => ({
          id: String(draft.rowIndex),
          label: draft.label || `Row ${draft.rowIndex + 1}`,
          detail: [draft.listingAddress, draft.floorOrUnit, draft.sizeSqft]
            .filter(Boolean)
            .join(' · '),
          errors: draft.errors,
        })),
        duplicateRows: result.duplicates.map((dup) => {
          const draft = result.drafts.find((d) => d.rowIndex === dup.rowIndex);
          return {
            id: String(dup.rowIndex),
            incomingLabel: draft?.label || `Row ${dup.rowIndex + 1}`,
            existingLabel: dup.existing.label || dup.existing.id,
            matchReason:
              dup.matchReason === 'external_id'
                ? 'Same Kato / external ID'
                : 'Same floor + label on listing',
          };
        }),
        validCount: result.validCount,
        errorCount: result.errorCount,
      };
    },
    [accountId],
  );

  const onCommit = useCallback(
    async (input: {
      headers: string[];
      rows: string[][];
      mapping: CsvFieldMapping;
      duplicateActions: Record<string, 'keep' | 'overwrite' | 'create_new'>;
    }) => {
      const result = await commitUnitImportAction({
        accountId,
        accountSlug,
        headers: input.headers,
        rows: input.rows,
        mapping: input.mapping,
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
    [accountId, accountSlug],
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 pt-4 text-sm md:px-0">
        <p className="text-[var(--workspace-shell-text)]/60">
          Import disposals first so units can match parent listings by address.
        </p>
        <Link
          href={listingsImportHref}
          className="text-[var(--workspace-shell-text)]/70 underline-offset-2 hover:underline"
        >
          ← Import disposals
        </Link>
      </div>

      <CsvImportWizard
        title="Import floor units"
        description="Upload a Kato / Numbers CSV of floor units. Units link to listings by Address."
        backHref={backHref}
        fieldOptions={UNIT_CSV_FIELD_OPTIONS}
        enableDuplicateReview
        parseCsvText={(text) =>
          parseCsvDetectingHeader(text, ['id', 'address'])
        }
        template={{
          filename: 'ozer-floor-units-template.csv',
          csv: buildUnitImportTemplateCsv(),
        }}
        onSuggestMapping={onSuggestMapping}
        onPreview={onPreview}
        onCommit={onCommit}
      />
    </div>
  );
}
